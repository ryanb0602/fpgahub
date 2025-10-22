// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css"; // Global styles (Tailwind + CSS vars)

import "@radix-ui/themes/styles.css"; // Radix UI themes

import { Theme } from "@radix-ui/themes";
// If you’re using a global context later (like Auth or Theme), import it here too:
// import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<BrowserRouter>
			{/* Wrap future providers here */}
			{/* <AuthProvider> */}
			<Theme
				accentColor="orange"
				grayColor="gray"
				background="dark"
				radius="large"
				scaling="95%"
				panelBackground="translucent"
				appearance="dark"
			>
				<div
					style={{
						minHeight: "100vh",
						background: "linear-gradient(0deg, #111111 0%, #DC602E 150%)",
					}}
				>
					<App />
				</div>
			</Theme>
			{/* </AuthProvider> */}
		</BrowserRouter>
	</React.StrictMode>,
);
