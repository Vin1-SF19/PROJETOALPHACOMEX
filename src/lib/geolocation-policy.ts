/** The application denies automatic geolocation. Unknown policy must not prompt. */
export function geolocalizacaoPermitida(doc: Document = document): boolean {
  const policyDocument = doc as Document & {
    permissionsPolicy?: { allowsFeature(feature: string): boolean };
    featurePolicy?: { allowsFeature(feature: string): boolean };
  };
  try {
    const policy = policyDocument.permissionsPolicy ?? policyDocument.featurePolicy;
    return policy?.allowsFeature("geolocation") === true;
  } catch { return false; }
}
