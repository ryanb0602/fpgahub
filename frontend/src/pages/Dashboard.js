import React, { useEffect, useState } from "react";
import { DashTopBar } from "../components/DashTopBar";
import { ModuleList } from "../components/ModuleList";

const API_BASE = process.env.REACT_APP_API_BASE;

export const Dashboard = () => {
  const [user_modules, setUserModules] = useState([]);

  const bodyStyle = {
    width: "100%",
    height: "calc(100vh - 10vh)", // remaining area below top bar
    display: "flex",
    justifyContent: "space-between",
    padding: "2rem",
    boxSizing: "border-box",
    gap: "2rem",
  };

  const colStyle = {
    flex: 1,
    background: "rgba(0,0,0,0.2)",
    borderRadius: "12px",
    padding: "1.5rem",
    overflowY: "auto",
  };

  const yourModules = async () => {
    const response = await fetch(`${API_BASE}/api/mymodules`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    const data = await response.json();

    const mapped = data.map((mod) => ({
      name: mod,
    }));
    setUserModules(mapped);
  };

  useEffect(() => {
    yourModules();
  }, []);

  return (
    <>
      <DashTopBar />
      <div style={bodyStyle}>
        <div style={colStyle}>
          <ModuleList
            title="Suggested"
            modules={[
              { name: "test1", id: "test1", isFavorite: false, verified: true },
              { name: "test2", id: "test2", isFavorite: true, verified: false },
            ]}
          />
        </div>

        <div style={colStyle}>
          {" "}
          <ModuleList title="Your Modules" modules={user_modules} />
        </div>

        <div style={colStyle}>
          {" "}
          <ModuleList
            title="Recent"
            modules={[
              { name: "test1", id: "test1", isFavorite: false, verified: true },
              { name: "test2", id: "test2", isFavorite: true, verified: false },
            ]}
          />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
