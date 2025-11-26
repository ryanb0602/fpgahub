import React, { useState } from "react";
import { Separator, Heading } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { ModuleBar } from "./ModuleBar";

export const ModuleList = ({ title, modules }) => {
	return (
		<>
			<Heading>{title}</Heading>
			<div style={{ height: "3vh" }} />
			{modules.map((module) => (
				<>
					<Separator orientation="horizontal" size="4" />
					<ModuleBar module={module} />
				</>
			))}
		</>
	);
};

export default ModuleList;
