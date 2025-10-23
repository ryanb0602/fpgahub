import { Routes, Route } from "react-router-dom";
import LandingPage from "../pages/LandingPage";
import Footer from "../components/Footer";
import Login from "../pages/Login";

export default function AppRouter() {
	return (
		<>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/login" element={<Login />} />
			</Routes>

			<Footer />
		</>
	);
}
