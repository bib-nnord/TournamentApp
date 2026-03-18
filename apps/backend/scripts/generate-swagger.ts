import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.3' });

async function generate() {
  const rootDir = path.resolve(__dirname, '..');
  const tempJsonPath = path.join(rootDir, 'swagger.generated.json');
  const outputYamlPath = path.join(rootDir, 'swagger.yaml');

  const endpointsFiles = [path.join(rootDir, 'server.ts')];

  const doc = {
    info: {
      title: 'Tournament App API',
      version: '1.0.0',
      description: 'Backend API for the Tournament App',
    },
    servers: [{ url: 'http://localhost:2000', description: 'Local development' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
          example: {
            error: 'Something went wrong',
          },
        },
      },
    },
  };

  await swaggerAutogen(tempJsonPath, endpointsFiles, doc);

  const generatedJson = JSON.parse(fs.readFileSync(tempJsonPath, 'utf8'));
  const yamlString = yaml.dump(generatedJson, {
    noRefs: true,
    lineWidth: 120,
  });

  fs.writeFileSync(outputYamlPath, yamlString, 'utf8');

  if (fs.existsSync(tempJsonPath)) {
    fs.unlinkSync(tempJsonPath);
  }

  console.log(`Swagger YAML generated at ${outputYamlPath}`);
}

generate().catch((err) => {
  console.error('Failed to generate Swagger YAML:', err);
  process.exit(1);
});
