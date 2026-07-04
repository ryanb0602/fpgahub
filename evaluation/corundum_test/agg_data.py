import glob
import pandas as pd

files = glob.glob("*/run*/summary.csv")
results = []

for file in files:
    df = pd.read_csv(file)
    parts = file.split("/")

    results.append(
        {
            "named_dir": parts[0],
            "run_id": parts[1],
            "sum_latency_sec": df["latency_sec"].sum(),
            "sum_cpu_time_sec": df["exact_cpu_time_sec"].sum(),
            "max_peak_rss_mb": df["exact_peak_rss_mb"].max(),
        }
    )

summary_df = pd.DataFrame(results)
summary_df.to_csv("aggregated_summary.csv", index=False)
print("Done!")
