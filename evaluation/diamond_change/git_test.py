import subprocess
import time
import shutil
import threading
import csv
import psutil
import os
import socket
from datetime import datetime

# ---------- Configuration Constants ----------
GIT_PORT = 9418
REMOTE_URL = f"git://localhost:{GIT_PORT}/test.git"
CONTAINER_NAME = "git-daemon-server"

current_phase = {"name": "idle"}


# ---------- Smart TCP Port Waiter ----------
def wait_for_port(host="localhost", port=9418, timeout=30.0):
    """Polls a TCP port until the server accepts connections or times out."""
    print(f"[init] Waiting for {host}:{port} (git-daemon) to become ready...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                print(f"[+] Server is up and listening on port {port}!")
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.2)
    raise TimeoutError(
        f"Server at {host}:{port} did not start within {timeout} seconds."
    )


# ---------- Helpers for process-tree CPU/mem ----------
def get_process_tree(pid):
    try:
        parent = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return []
    procs = [parent]
    try:
        procs.extend(parent.children(recursive=True))
    except psutil.NoSuchProcess:
        pass
    return procs


def sample_tree(procs):
    total_cpu = 0.0
    total_mem = 0.0
    alive = []
    for p in procs:
        try:
            total_cpu += p.cpu_percent(None)  # non-blocking delta
            total_mem += p.memory_info().rss / (1024 * 1024)
            alive.append(p)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return total_cpu, total_mem, alive


# ---------- Docker container monitor (cgroup-based, high resolution) ----------
def get_container_cgroup_paths(container_name):
    result = subprocess.run(
        ["docker", "inspect", "--format", "{{.Id}}", container_name],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    container_id = result.stdout.strip()

    candidates = [
        f"/sys/fs/cgroup/system.slice/docker-{container_id}.scope",
        f"/sys/fs/cgroup/docker/{container_id}",
    ]
    for base in candidates:
        if os.path.exists(os.path.join(base, "cpu.stat")):
            return base
    return None


def read_cgroup_metrics(cgroup_path):
    cpu_usage_usec = None
    mem_bytes = None
    try:
        with open(os.path.join(cgroup_path, "cpu.stat")) as f:
            for line in f:
                if line.startswith("usage_usec"):
                    cpu_usage_usec = int(line.split()[1])
                    break
        with open(os.path.join(cgroup_path, "memory.current")) as f:
            mem_bytes = int(f.read().strip())
    except (FileNotFoundError, ValueError):
        pass
    return cpu_usage_usec, mem_bytes


def monitor_docker_stats(container_name, log_file, stop_event, interval=0.02):
    cgroup_path = get_container_cgroup_paths(container_name)
    if cgroup_path is None:
        print(
            f"[monitor] Could not resolve cgroup path for {container_name}; "
            f"falling back to `docker stats` polling (low resolution)."
        )

    num_cpus = os.cpu_count() or 1

    with open(log_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "phase", "cpu_percent", "mem_mb"])

        last_ts = time.time()
        last_cpu_usec = None
        if cgroup_path:
            last_cpu_usec, _ = read_cgroup_metrics(cgroup_path)

        while not stop_event.is_set():
            now = time.time()

            if cgroup_path:
                cpu_usec, mem_bytes = read_cgroup_metrics(cgroup_path)
                if cpu_usec is not None and last_cpu_usec is not None:
                    dt = now - last_ts
                    d_cpu_sec = (cpu_usec - last_cpu_usec) / 1_000_000
                    cpu_pct = (d_cpu_sec / dt / num_cpus) * 100 if dt > 0 else 0.0
                else:
                    cpu_pct = 0.0
                mem_mb = (mem_bytes / (1024 * 1024)) if mem_bytes is not None else 0.0

                writer.writerow(
                    [now, current_phase["name"], round(cpu_pct, 2), round(mem_mb, 2)]
                )
                f.flush()

                last_ts, last_cpu_usec = now, cpu_usec
            else:
                result = subprocess.run(
                    [
                        "docker",
                        "stats",
                        "--no-stream",
                        "--format",
                        "{{.CPUPerc}},{{.MemUsage}}",
                        container_name,
                    ],
                    capture_output=True,
                    text=True,
                )
                if result.returncode == 0 and result.stdout.strip():
                    cpu, mem_usage = result.stdout.strip().split(",")
                    writer.writerow([now, current_phase["name"], cpu, mem_usage])
                    f.flush()

            time.sleep(interval)


def _exitcode_from_status(status):
    if hasattr(os, "waitstatus_to_exitcode"):
        return os.waitstatus_to_exitcode(status)
    if os.WIFEXITED(status):
        return os.WEXITSTATUS(status)
    if os.WIFSIGNALED(status):
        return -os.WTERMSIG(status)
    return None


# ---------- Command process monitor (process-tree, non-blocking, high-frequency) ----------
def run_and_monitor(cmd, phase_name, cwd, proc_log_file, poll_interval=0.02):
    current_phase["name"] = phase_name
    start = time.time()

    proc = subprocess.Popen(
        cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )

    known_pids = {}  # pid -> psutil.Process, primed

    def track(pid):
        if pid in known_pids:
            return
        try:
            p = psutil.Process(pid)
            p.cpu_percent(None)  # prime: first call always returns 0/garbage
            known_pids[pid] = p
        except psutil.NoSuchProcess:
            pass

    track(proc.pid)

    def is_running(pid):
        try:
            return psutil.Process(pid).status() != psutil.STATUS_ZOMBIE
        except psutil.NoSuchProcess:
            return False

    with open(proc_log_file, "a", newline="") as f:
        writer = csv.writer(f)
        while is_running(proc.pid):
            for p in get_process_tree(proc.pid):
                track(p.pid)

            total_cpu, total_mem, alive = sample_tree(list(known_pids.values()))
            known_pids = {p.pid: p for p in alive}

            writer.writerow(
                [time.time(), phase_name, round(total_cpu, 2), round(total_mem, 3)]
            )
            f.flush()
            time.sleep(poll_interval)

    exact_cpu_time_sec = None
    exact_peak_rss_mb = None
    try:
        _, status, rusage = os.wait4(proc.pid, 0)
        exact_cpu_time_sec = rusage.ru_utime + rusage.ru_stime
        exact_peak_rss_mb = rusage.ru_maxrss / 1024  # ru_maxrss is KB on Linux
        proc.returncode = _exitcode_from_status(status)
    except ChildProcessError:
        pass

    stdout, stderr = proc.communicate()
    end = time.time()
    latency = end - start

    print(f"--- {phase_name} ---")
    if stdout.strip():
        print(stdout.strip())
    if stderr.strip():
        print(stderr.strip())
    print(
        f"{phase_name} latency: {latency:.2f}s "
        f"(exact cpu_time={exact_cpu_time_sec}, exact peak_rss_mb={exact_peak_rss_mb})"
    )

    return {
        "phase": phase_name,
        "latency": latency,
        "returncode": proc.returncode,
        "exact_cpu_time_sec": exact_cpu_time_sec,
        "exact_peak_rss_mb": exact_peak_rss_mb,
    }


# ---------- One full run of the pipeline ----------
def run_once(run_dir):
    os.makedirs(run_dir, exist_ok=True)
    docker_log = os.path.join(run_dir, "docker_stats_log.csv")
    proc_log = os.path.join(run_dir, "process_stats_log.csv")
    summary_log = os.path.join(run_dir, "summary.csv")

    # 1. Reset Git Daemon environment and wipe old repository volumes
    subprocess.run(["docker", "compose", "down", "--volumes"], cwd="./git-daemon")
    shutil.rmtree("./git-daemon/repos", ignore_errors=True)
    os.makedirs("./git-daemon/repos", mode=0o777, exist_ok=True)

    subprocess.run(["docker", "compose", "up", "-d"], cwd="./git-daemon")

    # Smart wait: pauses until port 9418 accepts connections
    wait_for_port("localhost", GIT_PORT, timeout=30.0)

    print("[init] Pre-initializing bare repository /git/test.git on container...")
    subprocess.run(
        ["docker", "exec", CONTAINER_NAME, "git", "init", "--bare", "/git/test.git"],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "docker",
            "exec",
            CONTAINER_NAME,
            "git",
            "-C",
            "/git/test.git",
            "symbolic-ref",
            "HEAD",
            "refs/heads/main",
        ],
        check=True,
    )
    subprocess.run(
        ["docker", "exec", CONTAINER_NAME, "chmod", "-R", "777", "/git/test.git"],
        check=True,
    )

    # 3. Clean slate for ./v1/ to prevent 'nothing to commit' crashes
    shutil.rmtree("./v1/.git", ignore_errors=True)

    # 4. Seed initial baseline from ./v1/ (Only tracking Verilog *.v files!)
    print("[init] Seeding initial HDL baseline from ./v1/...")
    subprocess.run(["git", "init"], cwd="./v1/", check=True, stdout=subprocess.DEVNULL)
    subprocess.run(
        ["git", "config", "user.name", "Benchmark User"], cwd="./v1/", check=True
    )
    subprocess.run(
        ["git", "config", "user.email", "benchmark@rpi.edu"], cwd="./v1/", check=True
    )
    subprocess.run(["git", "add", "*.v"], cwd="./v1/", check=True)
    subprocess.run(
        ["git", "commit", "-m", "Initial baseline commit"],
        cwd="./v1/",
        check=True,
        stdout=subprocess.DEVNULL,
    )
    subprocess.run(["git", "branch", "-M", "main"], cwd="./v1/", check=True)
    subprocess.run(
        ["git", "remote", "add", "origin", REMOTE_URL], cwd="./v1/", check=True
    )
    subprocess.run(
        ["git", "push", "-u", "origin", "main", "--force"],
        cwd="./v1/",
        check=True,
        stdout=subprocess.DEVNULL,
    )

    os.makedirs("./temp_dir", exist_ok=True)

    with open(proc_log, "w", newline="") as f:
        csv.writer(f).writerow(["timestamp", "phase", "cpu_percent", "mem_rss_mb"])

    stop_event = threading.Event()
    monitor_thread = threading.Thread(
        target=monitor_docker_stats,
        args=(CONTAINER_NAME, docker_log, stop_event),
        kwargs={"interval": 0.02},
    )
    monitor_thread.start()

    results = []

    # --- PHASE 1: CLONE (Over native git:// protocol) ---
    results.append(
        run_and_monitor(
            ["git", "clone", REMOTE_URL, "./temp_dir/"],
            "clone",
            "./",
            proc_log,
        )
    )

    # --- PHASE 2: TRANSFER METADATA to ./v2_2/ ---
    shutil.copytree("./temp_dir/.git", "./v2_2/.git")
    subprocess.run(
        ["git", "config", "user.name", "Benchmark User"], cwd="./v2_2/", check=True
    )
    subprocess.run(
        ["git", "config", "user.email", "benchmark@rpi.edu"], cwd="./v2_2/", check=True
    )

    # --- PHASE 3: STAGE & COMMIT inside ./v2_2/ (Only HDL files!) ---
    results.append(
        run_and_monitor(
            ["git", "add", "*.v"],
            "add",
            "./v2_2/",
            proc_log,
        )
    )

    results.append(
        run_and_monitor(
            ["git", "commit", "-m", "Benchmark HDL change"],
            "commit",
            "./v2_2/",
            proc_log,
        )
    )

    # --- PHASE 4: PUSH over git:// ---
    results.append(
        run_and_monitor(
            ["git", "push", "-u", "origin", "main"],
            "push",
            "./v2_2/",
            proc_log,
        )
    )

    stop_event.set()
    monitor_thread.join()

    with open(summary_log, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "phase",
                "latency_sec",
                "returncode",
                "exact_cpu_time_sec",
                "exact_peak_rss_mb",
            ]
        )
        for r in results:
            writer.writerow(
                [
                    r["phase"],
                    r["latency"],
                    r["returncode"],
                    r.get("exact_cpu_time_sec"),
                    r.get("exact_peak_rss_mb"),
                ]
            )

    shutil.rmtree("./temp_dir", ignore_errors=True)
    shutil.rmtree("./v2_2/.git", ignore_errors=True)
    shutil.rmtree("./v1/.git", ignore_errors=True)

    return results


# ---------- Loop 30 times ----------
def main(num_runs=30):
    batch_root = f"runs_daemon_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(batch_root, exist_ok=True)

    for i in range(1, num_runs + 1):
        run_dir = os.path.join(batch_root, f"run_{i:03d}")
        print(f"\n===== RUN {i}/{num_runs} -> {run_dir} =====")
        try:
            run_once(run_dir)
        except Exception as e:
            with open(os.path.join(run_dir, "error.txt"), "w") as f:
                f.write(str(e))
            print(f"Run {i} failed: {e}")

    print(f"\nAll runs complete! Results saved in ./{batch_root}/")


if __name__ == "__main__":
    main(30)
