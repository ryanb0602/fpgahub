import * as React from "react";
import { Box, Heading, Section } from "@radix-ui/themes";

import { WebsiteNavigator } from "../components/WebsiteNavigator";
import CodeScrollText from "../components/CodeScrollText";
import LandingPageBlurb from "../components/LandingPageBlurb";
import DemoView from "../components/demoView";

export const LandingPage = () => {
	return (
		<>
			<Box
				width="20%"
				style={{
					position: "fixed",
					top: "20px",
					right: "25px",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					zIndex: 9999,
				}}
			>
				<WebsiteNavigator />
			</Box>
			<div style={{ display: "flex", width: "100%" }}>
				<Box
					style={{
						position: "absolute", // needed to respect top/left
						top: "5px", // distance from top
						left: "10px", // distance from left
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
					}}
				>
					<img src="/logo128.png" width="60%" height="60%" alt="Logo" />
				</Box>
			</div>
			<Section
				style={{
					marginTop: "20vh",
					display: "flex",
					flexDirection: "row",
					alignItems: "flex-start", // aligns content to left
					paddingLeft: "10%",
					gap: "10%",
				}}
				size="2"
			>
				<div>
					<Heading style={{ fontSize: "200px", lineHeight: "1" }}>FPGA</Heading>
					<Heading style={{ fontSize: "200px", lineHeight: "1" }}>Hub</Heading>
				</div>

				<CodeScrollText />
				<div style={{ marginTop: "90vh", paddingLeft: "20%", width: "50%" }}>
					<LandingPageBlurb />
				</div>
			</Section>
			<DemoView />
		</>
	);
};

export default LandingPage;
