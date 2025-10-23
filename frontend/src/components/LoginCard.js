import React, { useState } from "react";
import { Card, Text, Box, TextField, Button } from "@radix-ui/themes";

export const LoginCard = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

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
					style={{ width: "100%" }}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</Box>
			<Box style={{ width: "100%", maxWidth: "50%" }}>
				<TextField.Root
					size="3"
					placeholder="Password"
					style={{ width: "100%" }}
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
				<Button size="3" variant="soft" style={{ width: "25%" }}>
					Register
				</Button>
				<Button size="3" variant="primary" style={{ width: "25%" }}>
					Login
				</Button>
			</div>
		</Card>
	);
};

export default LoginCard;
