// Test to verify the truck type mapping
const testCases = [
  { mega_kast: "only_mega", expected: "Mega" },
  { mega_kast: "mega_and_kast", expected: "Mega+Kast" },
  { mega_kast: "nvt", expected: "N.v.t." },
  { mega_kast: "Mega", expected: "Mega" }, // fallback for old data
  { mega_kast: "Mega + Kast", expected: "Mega + Kast" }, // fallback for old data
  { mega_kast: null, expected: "Mega" }, // default
  { mega_kast: "", expected: "Mega" }, // default
];

console.log("Testing truck type mapping logic:\n");

testCases.forEach((test) => {
  const entry = { mega_kast: test.mega_kast };
  const result =
    entry.mega_kast === "mega_and_kast"
      ? "Mega+Kast"
      : entry.mega_kast === "nvt"
      ? "N.v.t."
      : entry.mega_kast === "only_mega"
      ? "Mega"
      : entry.mega_kast || "Mega";

  const status = result === test.expected ? "✓ PASS" : "✗ FAIL";
  console.log(
    `${status}: mega_kast="${test.mega_kast}" => "${result}" (expected: "${test.expected}")`
  );
});

console.log("\nAll tests completed!");
