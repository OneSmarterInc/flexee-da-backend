# Analytics Workbench Assets

This folder holds the downloadable analytics packages used by the student Analytics Workbench.

Expected structure:

```text
assets/
  analytics/
    demand-science/
      data.csv
      assignment.docx
    supplier-analytics/
      data.csv
      assignment.docx
    customer-intelligence/
      data.csv
      assignment.docx
    network-design/
      data.csv
      assignment.docx
    product-innovation/
      data.csv
      assignment.docx
    market-expansion/
      data.csv
      assignment.docx
```

Module directories:

- `demand-science`
- `supplier-analytics`
- `customer-intelligence`
- `network-design`
- `product-innovation`
- `market-expansion`

Each module directory must contain:

- `data.csv`
- `assignment.docx`

Operations or the deployment developer must place the real CSV and DOCX files before deployment.
The backend resolves this directory relative to the compiled SimulationService source file, so deploy or mount `assets/analytics` at the backend project root next to `src`/`dist`.
Missing files should produce a clear 404 response from the app, not a crash.
