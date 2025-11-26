import React, { useEffect, useState } from "react";
import { DashTopBar } from "../components/DashTopBar";
import { ModuleList } from "../components/ModuleList";

export const Dashboard = () => {
	const [search, setSearch] = useState("");

	const bodyStyle = {
		width: "100%",
		height: "calc(100vh - 10vh)", // remaining area below top bar
		display: "flex",
		justifyContent: "space-between",
		padding: "2rem",
		boxSizing: "border-box",
		gap: "2rem",
	};

	const colStyle = {
		flex: 1,
		background: "rgba(0,0,0,0.2)",
		borderRadius: "12px",
		padding: "1.5rem",
	};

	return (
		<>
			<DashTopBar search={search} setSearch={setSearch} />
			<div style={bodyStyle}>
				<div style={colStyle}>
					<ModuleList
						title="Suggested"
						modules={[
							{ name: "test1", id: "test1", isFavorite: false, verified: true },
							{ name: "test2", id: "test2", isFavorite: true, verified: false },
						]}
					/>
				</div>

				<div style={colStyle}>Center</div>

				<div style={colStyle}>Right</div>
			</div>
		</>
	);
};

export default Dashboard;
