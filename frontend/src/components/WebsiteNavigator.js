import React from "react";
import { Card, Text, Separator, Flex } from "@radix-ui/themes";
import { PersonIcon } from "@radix-ui/react-icons";
import { useLocation } from "react-router-dom";

export const WebsiteNavigator = () => {
	const location = useLocation();

	return (
		<Card>
			<Flex gap="4" align="center">
				{location.pathname !== "/" && (
					<>
						<a href="/" style={{ textDecoration: "none", color: "#ededed" }}>
							<Text size="5">Home</Text>
						</a>{" "}
						<Separator orientation="vertical" />
					</>
				)}

				<a href="#" style={{ textDecoration: "none", color: "#ededed" }}>
					<Text size="5">About</Text>
				</a>
				<Separator orientation="vertical" />
				<a href="#" style={{ textDecoration: "none", color: "#ededed" }}>
					<Text size="5">Documentation</Text>
				</a>
				<Separator orientation="vertical" />
				<a
					href="https://github.com/ryanb0602/fpgahub"
					style={{ textDecoration: "none", color: "#ededed" }}
				>
					<Text size="5">Source</Text>
				</a>
				{location.pathname !== "/login" && (
					<>
						<Separator orientation="vertical" />
						<a
							href="/login"
							style={{
								textDecoration: "none",
								color: "#ededed",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<PersonIcon width="17" height="17" />
						</a>
					</>
				)}
			</Flex>
		</Card>
	);
};

export default WebsiteNavigator;
