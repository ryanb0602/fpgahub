import React, { useEffect, useState } from "react";
import { Heading, Select } from "@radix-ui/themes";

const API_BASE = process.env.REACT_APP_API_BASE;

export const ModuleTopBar = ({ name, commit, setCommit }) => {
	const [commits, setCommits] = useState([]);
	const [loading, setLoading] = useState(true);

	const loadCommits = async () => {
		try {
			const response = await fetch(`${API_BASE}/api/commits?id=${name}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});
			const data = await response.json();

			setCommits(data);

			if (data.length > 0) {
				const mostRecent = data.reduce((a, b) =>
					new Date(b.timestamp) > new Date(a.timestamp) ? b : a,
				);

				setCommit(mostRecent);
			}
			setLoading(false);
		} catch (error) {
			console.error("Error fetching commits:", error);
		}
	};

	useEffect(() => {
		loadCommits();
	}, []);

	return (
		<>
			<div
				style={{
					width: "100%",
					height: "8vh",
					background: "linear-gradient(to bottom, #3b1205, #1a0703)",
					borderBottom: "1px solid rgba(255, 124, 57, 0.35)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between", // left + right spacing
					padding: "0 2rem",
					boxSizing: "border-box",
				}}
			>
				{/* LEFT */}
				<div style={{ display: "flex", justifyContent: "flex-start" }}>
					<img src="/logo128.png" width="40%" height="40%" alt="Logo" />
				</div>

				{/* CENTER */}
				<div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
					<Heading size="7" style={{ color: "white" }}>
						{name}
					</Heading>
				</div>

				{/* RIGHT */}
				<div style={{ display: "flex", justifyContent: "flex-end" }}>
					<Select.Root
						value={commit ? commit.commit_hash : ""}
						onValueChange={(value) => {
							const selected = commits.find((c) => c.commit_hash === value);
							if (selected) setCommit(selected);
						}}
					>
						<Select.Trigger />
						<Select.Content>
							{commits.map((c) => (
								<Select.Item
									key={c.commit_hash}
									value={c.commit_hash}
									onSelect={() => setCommit(c)}
								>
									{c.commit_hash}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
		</>
	);
};

export default ModuleTopBar;
