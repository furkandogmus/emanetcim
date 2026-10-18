# BagajPark Local CI — runs GitHub Actions workflows via act (Docker)
# Usage: make ci       (web: lint, typecheck, test, build)
#        make all      (ci ile ayni)

.PHONY: ci all clean

# Default act flags: use medium runner image, pull latest
ACT_FLAGS = --pull --container-architecture linux/amd64

ci:
	@echo "=== Running Web CI locally ==="
	act -W .github/workflows/ci.yml $(ACT_FLAGS)

all: ci

clean:
	@echo "Cleaning act cache..."
	rm -rf /tmp/act* ~/.cache/act
	docker system prune -f --filter "label=act"
