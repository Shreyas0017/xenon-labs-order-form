import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, isAdminEmail } from "@/lib/firebase";

const Index = () => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	if (loading) {
		return <div className="min-h-screen bg-background" />;
	}

	if (!user) {
		return <Navigate to="/auth" replace />;
	}

	if (isAdminEmail(user.email)) {
		return <Navigate to="/admin" replace />;
	}

	return <Navigate to="/status" replace />;
};

export default Index;
