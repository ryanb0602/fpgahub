import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE;

export default function PublicOnlyRoute({ children }) {
	const [loading, setLoading] = useState(true);
	const [authorized, setAuthorized] = useState(false);

	useEffect(() => {
		fetch(`${API_BASE}/auth/me`, { credentials: "include" })
			.then((res) => res.json())
			.then((data) => {
				setAuthorized(data.loggedIn);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	if (loading) return <div>Loading...</div>;

	if (authorized) return <Navigate to="/dashboard" replace />;

	return children;
}
