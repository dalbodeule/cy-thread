export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/account/email' || to.path === '/account/verify-email' || to.path === '/login')
    return;
  const { user, loggedIn } = useUserSession();
  if (loggedIn.value && !user.value?.email) return navigateTo('/account/email');
});
