import React, { useEffect, useRef, useState } from "react";
import { Box, Spinner, TextField, IconButton } from "@radix-ui/themes";
import {
	MagnifyingGlassIcon,
	PersonIcon,
	Share1Icon,
} from "@radix-ui/react-icons";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE;

export const DashTopBar = () => {
	const [search, setSearch] = useState("");
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [showDropdown, setShowDropdown] = useState(false);
	const [hoveredIndex, setHoveredIndex] = useState(-1);

	const containerRef = useRef(null);
	const navigate = useNavigate();

	// Debounced search: fires 300 ms after the user stops typing
	useEffect(() => {
		if (!search || search.trim().length === 0) {
			setResults([]);
			setShowDropdown(false);
			setLoading(false);
			return;
		}

		setLoading(true);

		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`${API_BASE}/api/search?q=${encodeURIComponent(search.trim())}`,
					{ credentials: "include" },
				);
				if (!res.ok) {
					setResults([]);
					return;
				}
				const data = await res.json();
				setResults(Array.isArray(data) ? data : []);
				setShowDropdown(true);
			} catch (err) {
				console.error(err);
				setResults([]);
			} finally {
				setLoading(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [search]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (containerRef.current && !containerRef.current.contains(e.target)) {
				setShowDropdown(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = (moduleName) => {
		setShowDropdown(false);
		setSearch("");
		navigate(`/module?id=${encodeURIComponent(moduleName)}`);
	};

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
					justifyContent: "space-between",
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
					<div
						ref={containerRef}
						style={{ flex: 1, maxWidth: "35%", position: "relative" }}
					>
						<Box style={{ width: "100%" }}>
							<TextField.Root
								placeholder="Search for modules…"
								size="3"
								style={{ width: "100%" }}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								onFocus={() => results.length > 0 && setShowDropdown(true)}
							>
								<TextField.Slot>
									<MagnifyingGlassIcon height="16" width="16" />
								</TextField.Slot>
								{loading && (
									<TextField.Slot side="right">
										<Spinner size="1" />
									</TextField.Slot>
								)}
							</TextField.Root>
						</Box>

						{showDropdown && results.length > 0 && (
							<div
								style={{
									position: "absolute",
									top: "100%",
									left: 0,
									right: 0,
									background: "#1a0703",
									border: "1px solid rgba(255, 124, 57, 0.35)",
									borderTop: "none",
									borderRadius: "0 0 8px 8px",
									zIndex: 1000,
									maxHeight: "300px",
									overflowY: "auto",
								}}
							>
								{results.map((mod, i) => (
									<div
										key={mod}
										style={{
											padding: "0.65rem 1rem",
											cursor: "pointer",
											borderBottom:
												i < results.length - 1
													? "1px solid rgba(255, 124, 57, 0.15)"
													: "none",
											background:
												hoveredIndex === i
													? "rgba(255, 124, 57, 0.1)"
													: "transparent",
											color: "rgba(255,255,255,0.9)",
											fontSize: "0.875rem",
										}}
										onMouseEnter={() => setHoveredIndex(i)}
										onMouseLeave={() => setHoveredIndex(-1)}
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => handleSelect(mod)}
									>
										{mod}
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* RIGHT */}
				<div
					style={{
						display: "flex",
						justifyContent: "flex-end",
						spacing: "1.5rem",
						gap: "1.5rem",
					}}
				>
					<IconButton variant="ghost">
						<Share1Icon height={25} width={25} />
					</IconButton>
					<IconButton variant="ghost">
						<PersonIcon height={25} width={25} />
					</IconButton>
				</div>
			</div>
		</>
	);
};

export default DashTopBar;
