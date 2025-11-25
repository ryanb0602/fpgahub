import React, { useState } from "react";
import { Card, Text, Box, TextField, Button } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE;

export const LoginCard = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const navigate = useNavigate();

	const login = async () => {
		try {
			const response = await fetch(`${API_BASE}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password }),
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Login failed");
			}

			const data = await response.json();

			navigate(`/dashboard`);
		} catch (error) {
			console.error("Login failed:", error);
		}
	};

	return (
		<Card
			style={{
				width: "30%",
				height: "30vh",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				gap: "20px",
			}}
		>
			<Text size="7" style={{ marginBottom: "25px" }}>
				Login
			</Text>

			<Box style={{ width: "100%", maxWidth: "50%" }}>
				<TextField.Root
					size="3"
					placeholder="Email address"
					type="email"
					style={{ width: "100%" }}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</Box>
			<Box style={{ width: "100%", maxWidth: "50%" }}>
				<TextField.Root
					size="3"
					placeholder="Password"
					type="password"
					style={{
						width: "100%",
					}}
					onChange={(e) => setPassword(e.target.value)}
				/>
			</Box>

			<div
				style={{
					marginTop: "20px",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					width: "100%",
					flexDirection: "row",
					gap: "20px",
				}}
			>
				<Button
					size="3"
					variant="soft"
					style={{ width: "25%" }}
					onClick={() => navigate("/register")}
				>
					Register
				</Button>
				<Button
					size="3"
					variant="primary"
					style={{ width: "25%" }}
					onClick={login}
				>
					Login
				</Button>
			</div>
		</Card>
	);
};

export default LoginCard;
