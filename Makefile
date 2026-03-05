EXTENSION_NAME = undisposition
VERSION = $(shell python3 -c "import json; print(json.load(open('manifest.json'))['version'])")

# Files to include in the extension zip
EXTENSION_FILES = \
	manifest.json \
	undisposition_bg.js \
	icons/icon16.png \
	icons/icon19.png \
	icons/icon48.png \
	icons/icon128.png \
	pages/settings.html \
	pages/settings.js

.PHONY: zip clean test

## Build Firefox extension zip
zip: clean
	@echo "Building $(EXTENSION_NAME)-$(VERSION).zip"
	@zip -r $(EXTENSION_NAME)-$(VERSION).zip $(EXTENSION_FILES)
	@echo "Done: $(EXTENSION_NAME)-$(VERSION).zip"

## Start local test server (usage: make test [PORT=8888])
test:
	python3 test/server.py $(PORT)

## Remove build artifacts
clean:
	@rm -f $(EXTENSION_NAME)-*.zip
