import React, { useState } from "react";
import { useLocation } from "react-router-dom";

import { ModuleTopBar } from "../components/ModuleTopBar";
import { ModuleViewer } from "../components/ModuleViewer";

export const ModulePage = () => {
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const moduleId = searchParams.get("id"); // replace "myParam" with your key

  const [commit, setCommit] = useState(null);

  return (
    <>
      <ModuleTopBar name={moduleId} commit={commit} setCommit={setCommit} />
      <div
        style={{
          width: "98%",
          display: "flex",
          justfifyContent: "center",
          margin: "auto",
        }}
      >
        <ModuleViewer name={moduleId} commit={commit?.commit_hash} />
      </div>
    </>
  );
};

export default ModulePage;
