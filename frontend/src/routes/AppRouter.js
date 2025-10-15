import { Routes, Route } from "react-router-dom";
import LandingPage from "../pages/LandingPage";

export default function AppRouter() {
	return (
		<Routes>
			<Route path="/" element={<LandingPage />} />
			{/* Future protected routes */}
		</Routes>
	);
}
