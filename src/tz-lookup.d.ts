// `tz-lookup` ships no types. It's a single CommonJS function: (lat, lon) => IANA zone string.
declare module 'tz-lookup' {
  const tzlookup: (lat: number, lon: number) => string;
  export default tzlookup;
}
