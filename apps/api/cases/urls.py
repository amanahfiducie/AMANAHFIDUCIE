from rest_framework.routers import SimpleRouter

from cases.views import FiduciaryCaseViewSet

router = SimpleRouter()
router.register("cases", FiduciaryCaseViewSet, basename="case")

urlpatterns = router.urls
