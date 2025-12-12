// server/data/convert-populated-places.mjs
import { read } from 'shapefile';
import fs from 'node:fs/promises';

async function main() {
  console.log('✅ Script started');

  const shpPath = './ne_10m_populated_places.shp';
  const dbfPath = './ne_10m_populated_places.dbf';

  console.log('📂 Reading shapefile:', shpPath, dbfPath);

  try {
    const featureCollection = await read(shpPath, dbfPath);
    console.log('📝 Read OK, feature count:', featureCollection.features?.length);

    const outPath = './ne_10m_populated_places.geojson';
    console.log('💾 Writing GeoJSON to', outPath);

    await fs.writeFile(
      outPath,
      JSON.stringify(featureCollection),
      'utf8'
    );

    console.log('🎉 Done! Created', outPath);
  } catch (err) {
    console.error('💥 Conversion failed:');
    console.error(err);
    process.exit(1);
  }
}

main();
