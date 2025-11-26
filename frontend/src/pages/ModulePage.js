import React, { useState } from "react";
import { useLocation } from "react-router-dom";

import { ModuleTopBar } from "../components/ModuleTopBar";

export const ModulePage = () => {
	const location = useLocation();

	const searchParams = new URLSearchParams(location.search);
	const moduleId = searchParams.get("id"); // replace "myParam" with your key

	const [commit, setCommit] = useState(null);

	return (
		<>
			<ModuleTopBar name={moduleId} commit={commit} setCommit={setCommit} />
		</>
	);
};

export default ModulePage;
