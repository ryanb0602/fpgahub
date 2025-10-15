import React, { useEffect, useState } from "react";
import { Box, Text, Strong } from "@radix-ui/themes";

export default function LandingPageBlurb() {
	const [scrollY, setScrollY] = useState(0);

	useEffect(() => {
		const handleScroll = () => setScrollY(window.scrollY);
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const containerStyle = {
		position: "relative",
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		transform: `translateX(${-Math.min(scrollY / 6, 186)}%`,
		width: "200%",
	};

	return (
		<>
			<Box style={containerStyle}>
				<Text
					wrap="pretty"
					align="center"
					width="100%"
					style={{ fontSize: "50px", lineHeight: "1" }}
				>
					<Strong>A repo manager designed specifically for HDLs</Strong>
				</Text>
				<ul style={{ marginTop: "20px", lineHeight: "2", fontSize: "28px" }}>
					<li>
						<Text size="7">Test</Text>
					</li>
					<li>
						<Text size="7">Test</Text>
					</li>
				</ul>
			</Box>
		</>
	);
}
