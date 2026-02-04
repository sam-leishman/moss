export const load = async ({ fetch }) => {
	const [usersRes, librariesRes] = await Promise.all([
		fetch('/api/users'),
		fetch('/api/libraries')
	]);

	const users = usersRes.ok ? (await usersRes.json()).users : [];
	const libraries = librariesRes.ok ? (await librariesRes.json()).libraries : [];

	return {
		users,
		libraries
	};
};
