import * as React from "react";
import { Box, Heading, Section } from "@radix-ui/themes";

import { WebsiteNavigator } from "../components/WebsiteNavigator";
import { RegisterCard } from "../components/RegisterCard";

export const Register = () => {
	return (
		<>
			<Box
				width="25%"
				style={{
					position: "fixed",
					top: "20px",
					right: "5px",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					zIndex: 9999,
				}}
			>
				<WebsiteNavigator />
			</Box>
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "93vh",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<RegisterCard />
			</div>
		</>
	);
};

export default Register;
