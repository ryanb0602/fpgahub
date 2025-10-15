import React from "react";
import { Card, Text, Separator, Flex } from "@radix-ui/themes";

export const WebsiteNavigator = () => {
	return (
		<Card>
			<Flex gap="4" align="center">
				<a href="#" style={{ textDecoration: "none", color: "#ededed" }}>
					<Text size="5">About</Text>
				</a>
				<Separator orientation="vertical" />
				<a href="#" style={{ textDecoration: "none", color: "#ededed" }}>
					<Text size="5">Documentation</Text>
				</a>
				<Separator orientation="vertical" />
				<a href="#" style={{ textDecoration: "none", color: "#ededed" }}>
					<Text size="5">Source</Text>
				</a>
			</Flex>
		</Card>
	);
};

export default WebsiteNavigator;
