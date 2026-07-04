import subprocess
import pexpect
import time
import shutil
import threading
import csv
import psutil
import os
from datetime import datetime

current_phase = {"name": "idle"}


# ---------- Docker container monitor ----------
def monitor_docker_stats(container_name, log_file, stop_event, interval=1.0):
    with open(log_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "timestamp",
                "phase",
                "cpu_percent",
                "mem_usage",
                "mem_percent",
                "net_io",
                "block_io",
            ]
        )
        while not stop_event.is_set():
            result = subprocess.run(
                [
                    "docker",
                    "stats",
                    "--no-stream",
                    "--format",
                    "{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}",
                    container_name,
                ],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0 and result.stdout.strip():
                cpu, mem_usage, mem_pct, net_io, block_io = result.stdout.strip().split(
                    ","
                )
                writer.writerow(
                    [
                        time.time(),
                        current_phase["name"],
                        cpu,
                        mem_usage,
                        mem_pct,
                        net_io,
                        block_io,
                    ]
                )
                f.flush()
            time.sleep(interval)


# ---------- Command process monitor ----------
def run_and_monitor(cmd, phase_name, cwd, proc_log_file, interval=0.2):
    current_phase["name"] = phase_name
    start = time.time()

    proc = subprocess.Popen(
        cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    ps_proc = psutil.Process(proc.pid)

    with open(proc_log_file, "a", newline="") as f:
        writer = csv.writer(f)
        while proc.poll() is None:
            try:
                cpu = ps_proc.cpu_percent(interval=interval)
                mem = ps_proc.memory_info().rss / (1024 * 1024)
                writer.writerow([time.time(), phase_name, cpu, mem])
                f.flush()
            except psutil.NoSuchProcess:
                break

    end = time.time()
    stdout, stderr = proc.communicate()
    latency = end - start

    print(f"--- {phase_name} ---")
    print(stdout, stderr)
    print(f"{phase_name} latency: {latency:.2f}s")

    return {"phase": phase_name, "latency": latency, "returncode": proc.returncode}


# ---------- One full run of the pipeline ----------
def run_once(run_dir):
    os.makedirs(run_dir, exist_ok=True)
    docker_log = os.path.join(run_dir, "docker_stats_log.csv")
    proc_log = os.path.join(run_dir, "process_stats_log.csv")
    summary_log = os.path.join(run_dir, "summary.csv")

    subprocess.run(["docker", "compose", "down", "--volumes"], cwd="../../backend")
    subprocess.run(
        ["docker", "compose", "up", "--build", "--detach", "--wait"],
        cwd="../../backend",
    )
    time.sleep(10)
    subprocess.run(["fpgahub", "logout"])

    child = pexpect.spawn("fpgahub register", encoding="utf-8", timeout=15)
    child.expect("First Name:")
    child.sendline("Ryan")
    child.expect("Last Name:")
    child.sendline("Berube")
    child.expect("Email:")
    child.sendline("berubr@rpi.edu")
    child.expect("Password:")
    child.sendline("testtest123A##")
    child.expect("Confirm Password:")
    child.sendline("testtest123A##")
    child.expect(pexpect.EOF)

    child = pexpect.spawn("fpgahub login", encoding="utf-8", timeout=15)
    child.expect("Email:")
    child.sendline("berubr@rpi.edu")
    child.expect("Password:")
    child.sendline("testtest123A##")
    child.expect(pexpect.EOF)

    with open(proc_log, "w", newline="") as f:
        csv.writer(f).writerow(["timestamp", "phase", "cpu_percent", "mem_rss_mb"])

    stop_event = threading.Event()
    monitor_thread = threading.Thread(
        target=monitor_docker_stats,
        args=("backend-server-1", docker_log, stop_event),
        kwargs={"interval": 1.0},
    )
    monitor_thread.start()

    results = []
    results.append(
        run_and_monitor(
            ["fpgahub", "commit", "mqnic_core_axi"],
            "commit",
            "./corundum/fpga/common/rtl/",
            proc_log,
        )
    )
    results.append(
        run_and_monitor(
            ["fpgahub", "push"], "push", "./corundum/fpga/common/rtl/", proc_log
        )
    )

    stop_event.set()
    monitor_thread.join()

    with open(summary_log, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["phase", "latency_sec", "returncode"])
        for r in results:
            writer.writerow([r["phase"], r["latency"], r["returncode"]])

    shutil.rmtree("./corundum/fpga/common/rtl/.fpgahub", ignore_errors=True)

    return results


# ---------- Loop 30 times ----------
def main(num_runs=30):
    batch_root = f"runs_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(batch_root, exist_ok=True)

    for i in range(1, num_runs + 1):
        run_dir = os.path.join(batch_root, f"run_{i:03d}")
        print(f"\n===== RUN {i}/{num_runs} -> {run_dir} =====")
        try:
            run_once(run_dir)
        except Exception as e:
            # log the failure but keep going so one bad run doesn't kill the batch
            with open(os.path.join(run_dir, "error.txt"), "w") as f:
                f.write(str(e))
            print(f"Run {i} failed: {e}")

    print(f"\nAll runs complete. Results in ./{batch_root}/")


if __name__ == "__main__":
    main(30)
