import React, { useState } from "react";
import { Card, Text, Box, TextField, Button } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { color } from "@uiw/react-codemirror";

const API_BASE = process.env.REACT_APP_API_BASE;

export const RegisterCard = () => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const navigate = useNavigate();
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const passwordRegex =
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,128}$/;

	const register = async () => {
		if (!emailRegex.test(email)) {
			alert("Please enter a valid email address");
			return;
		}

		if (!passwordRegex.test(password)) {
			alert(
				"Password must have one lowercase, one uppercase, one number, one special character and atleast 8 characters.",
			);
			return;
		}

		if (password !== passwordConfirm) {
			alert("Passwords do not match");
			return;
		}

		try {
			const response = await fetch(`${API_BASE}/auth/register`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstname: firstName,
					lastname: lastName,
					email: email,
					password: password,
				}),
			});

			if (response.ok) {
				navigate("/login");
			}
		} catch (error) {
			console.error("Error during registration:", error);
			alert("An error occurred during registration. Please try again later.");
		}
	};

	return (
		<Card
			style={{
				width: "30%",
				height: "50vh",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				gap: "20px",
			}}
		>
			<Text size="7" style={{ marginBottom: "25px" }}>
				Register
			</Text>
			<div
				style={{
					marginTop: "20px",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					width: "100%",
					flexDirection: "row",
					gap: "10px",
				}}
			>
				<Box style={{ width: "50%", maxWidth: "25%" }}>
					<TextField.Root
						size="3"
						placeholder="First Name"
						style={{ width: "100%" }}
						onChange={(e) => setFirstName(e.target.value)}
					/>
				</Box>
				<Box style={{ width: "50%", maxWidth: "25%" }}>
					<TextField.Root
						size="3"
						placeholder="Last Name"
						style={{ width: "100%" }}
						onChange={(e) => setLastName(e.target.value)}
					/>
				</Box>
			</div>
			<Box style={{ width: "100%", maxWidth: "50%" }}>
				<TextField.Root
					size="3"
					placeholder="Email address"
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
						color:
							!passwordRegex.test(password) && password.length > 0
								? "red"
								: "inherit",
					}}
					onChange={(e) => setPassword(e.target.value)}
				/>
			</Box>
			<Box style={{ width: "100%", maxWidth: "50%" }}>
				<TextField.Root
					size="3"
					placeholder="Confirm Password"
					type="password"
					style={{ width: "100%" }}
					onChange={(e) => setPasswordConfirm(e.target.value)}
				/>
			</Box>
			{password !== passwordConfirm && (
				<Text size="2" style={{ color: "red" }}>
					Passwords do not match
				</Text>
			)}
			{password == passwordConfirm && (
				<Text
					size="2"
					style={{ width: "50%", textAlign: "center", color: "gray" }}
				>
					Password must have one lowercase, one uppercase, one number, one
					special character and atleast 8 characters.
				</Text>
			)}
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
					variant="primary"
					style={{ width: "25%" }}
					onClick={register}
				>
					Confirm
				</Button>
			</div>
		</Card>
	);
};
export default RegisterCard;
