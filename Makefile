# BagajPark Local CI — runs GitHub Actions workflows via act (Docker)
# Usage: make ci       (web: lint, typecheck, test, build)
#        make mobile   (Flutter: analyze, test, build APK)
#        make all      (both)

.PHONY: ci mobile all clean

# Default act flags: use medium runner image, pull latest
ACT_FLAGS = --pull --container-architecture linux/amd64

ci:
	@echo "=== Running Web CI locally ==="
	act -W .github/workflows/ci.yml $(ACT_FLAGS)

mobile:
	@echo "=== Running Mobile CI locally ==="
	act -W .github/workflows/mobile-ci.yml $(ACT_FLAGS)

all: ci mobile

clean:
	@echo "Cleaning act cache..."
	rm -rf /tmp/act* ~/.cache/act
	docker system prune -f --filter "label=act"
