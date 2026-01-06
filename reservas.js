const tbody = document.getElementById("tabla-reservas");

fetch("http://localhost:3001/reservas")
  .then(res => res.json())
  .then(data => {
    tbody.innerHTML = "";

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">No hay reservas aún</td>
        </tr>
      `;
      return;
    }

    data.forEach(r => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.profesional}</td>
        <td>${r.categoria}</td>
        <td>${r.ciudad}</td>
        <td>$${r.precio}</td>
        <td class="${r.estado}">${r.estado}</td>
        <td>${r.created_at}</td>
      `;

      tbody.appendChild(tr);
    });
  })
  .catch(err => {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7">Error cargando reservas</td>
      </tr>
    `;
  });
