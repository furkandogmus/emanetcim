export default {
  locales: ["en", "tr"],
  output: "src/locales/$LOCALE.json",
  input: ["src/**/*.{js,jsx,ts,tsx}"],
  sort: true,
  createOldCatalogs: false,
  defaultValue: (locale, namespace, key) => {
    return key;
  },
  keySeparator: ".",
  namespaceSeparator: ":",
}
