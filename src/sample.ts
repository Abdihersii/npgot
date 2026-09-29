export const petstoreSample = `openapi: 3.0.3
info:
  title: Tiny Petstore
  version: 1.0.0
servers:
  - url: https://petstore.example.com
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
    post:
      operationId: createPet
      summary: Create a pet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
                tag: { type: string }
      responses:
        '201': { description: Created }
  /pets/{petId}:
    get:
      operationId: getPet
      summary: Get a pet
      parameters:
        - name: petId
          in: path
          required: true
          schema: { type: string }
    delete:
      operationId: deletePet
      summary: Delete a pet
      parameters:
        - name: petId
          in: path
          required: true
          schema: { type: string }
`;
