import { Routes, Route } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import Footer from "../components/Footer";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";

import ProtectedRoute from "../components/ProtectedRoute";
import PublicOnlyRoute from "../components/PublicOnlyRoute";

export default function AppRouter() {
	return (
		<>
			<Routes>
				<Route path="/" element={<LandingPage />} />

				<Route
					path="/login"
					element={
						<PublicOnlyRoute>
							<Login />
						</PublicOnlyRoute>
					}
				/>

				<Route
					path="/register"
					element={
						<PublicOnlyRoute>
							<Register />
						</PublicOnlyRoute>
					}
				/>

				<Route
					path="/dashboard"
					element={
						<ProtectedRoute>
							<Dashboard />
						</ProtectedRoute>
					}
				/>
			</Routes>

			<Footer />
		</>
	);
}
