export type Env = Readonly<Record<typeof requiredKeys[number], string>>
const requiredKeys = [
  'ESA_WEBHOOK_SECRET',
  'ESA_PRIVATE_CATEGORY_REGEX',
  'DATOCMS_FULL_ACCESS_API_TOKEN',
  'DATOCMS_POST_ITEM_ID',
  'ESA_API_TOKEN',
  'ESA_TEAM',
] as const

export const isValidEnv = (
  env: NodeJS.ProcessEnv & Partial<Record<keyof Env, unknown>>,
  errors: string[] = []
): env is Env => {
  for (const key of requiredKeys) {
    if (typeof env[key] !== 'string') {
      errors.push(`env variable ${key} was not set.`)
    }
  }
  return errors.length === 0
}
