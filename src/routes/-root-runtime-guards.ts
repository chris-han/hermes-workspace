export function wrapInlineScript(source: string): string {
  return `(() => {\n  try {\n${source}\n  } catch (error) {\n    console.error('Inline bootstrap script failed', error)\n  }\n})()`
}

type ServiceWorkerLike = {
  getRegistrations: () => Promise<
    ReadonlyArray<{ unregister: () => boolean | void | Promise<boolean | void> }>
  >
}

type CachesLike = {
  keys: () => Promise<Array<string>>
  delete: (name: string) => Promise<boolean> | boolean
}

export async function unregisterServiceWorkers({
  serviceWorker,
  cachesApi,
}: {
  serviceWorker?: ServiceWorkerLike
  cachesApi?: CachesLike
}): Promise<void> {
  await serviceWorker
    ?.getRegistrations()
    .then((registrations) =>
      Promise.allSettled(
        registrations.map((registration) => registration.unregister()),
      ),
    )
    .catch(() => undefined)

  await cachesApi
    ?.keys()
    .then((names) =>
      Promise.allSettled(names.map((name) => cachesApi.delete(name))),
    )
    .catch(() => undefined)
}
