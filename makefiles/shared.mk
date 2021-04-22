COMMIT_HASH=$(shell git rev-parse --short HEAD)
INTEGRATION_SEARCH_BUCKET=docs-search-indexes-integration

ifeq ($(SNOOTY_INTEGRATION),true)
	BUCKET_FLAG=-b ${INTEGRATION_SEARCH_BUCKET}
endif

get-project-name:
	@echo ${PROJECT};

## Update the search index for this branch
next-gen-deploy-search-index:
	@echo "Building search index"
	mut-index upload public -o ${MANIFEST_PREFIX}.json -u ${PRODUCTION_URL}/${MUT_PREFIX} -s ${GLOBAL_SEARCH_FLAG} $(BUCKET_FLAG)

next-gen-stage: ## Host online for review
	# stagel local jobs \
	if [ -n "${PATCH_ID}" -a "${MUT_PREFIX}" = "${PROJECT}" ]; then \
		mut-publish public ${STAGING_BUCKET} --prefix="${COMMIT_HASH}/${PATCH_ID}/${MUT_PREFIX}" --stage ${ARGS}; \
		echo "Hosted at ${STAGING_URL}/${COMMIT_HASH}/${PATCH_ID}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/"; \
	# reg github push and stagel commit jobs \
	else \
		mut-publish public ${STAGING_BUCKET} --prefix="${MUT_PREFIX}" --stage ${ARGS}; \
		echo "Hosted at ${STAGING_URL}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/"; \
	fi