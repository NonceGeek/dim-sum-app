export type AppRouteContext = {
  params?: Promise<Record<string, string | string[] | undefined>>;
};

export async function getStringRouteParam(
  context: AppRouteContext,
  key: string
) {
  const params = context.params ? await context.params : undefined;
  const value = params?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

