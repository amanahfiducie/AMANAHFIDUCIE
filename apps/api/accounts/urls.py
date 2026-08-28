from django.urls import path
from rest_framework.routers import SimpleRouter

from accounts.views import (
    ChangePasswordView,
    JWTPublicObtainPairView,
    JWTPublicRefreshView,
    LoginStartView,
    LoginVerifyView,
    MeView,
    ProfileUserAccessRequestViewSet,
    UserViewSet,
    VerifyPasswordView,
)

router = SimpleRouter()
router.register("users", UserViewSet, basename="user")
router.register(
    "user-access-requests",
    ProfileUserAccessRequestViewSet,
    basename="user-access-request",
)

urlpatterns = [
    path("auth/login/start/", LoginStartView.as_view(), name="login-start"),
    path("auth/login/verify/", LoginVerifyView.as_view(), name="login-verify"),
    path("auth/token/", JWTPublicObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", JWTPublicRefreshView.as_view(), name="token_refresh"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("me/", MeView.as_view(), name="me"),
    path("auth/verify-password/", VerifyPasswordView.as_view(), name="verify-password"),
    *router.urls,
]
