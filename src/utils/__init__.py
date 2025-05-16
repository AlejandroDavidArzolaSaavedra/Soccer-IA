import csv
import os

# Rutas relativas desde la ubicación actual del script
base_path = os.path.dirname(__file__)
entrada_path = os.path.join(base_path, 'entrada.txt')
salida_path = os.path.join(base_path, 'salida.csv')

with open(entrada_path, 'r', encoding='utf-8') as infile, open(salida_path, 'w', newline='', encoding='utf-8') as outfile:
    writer = csv.writer(outfile)
    writer.writerow(['Ranking', 'Name', 'Team', 'PM', 'Y.C.', 'R.C.'])

    # Eliminar líneas vacías y espacios sobrantes
    lines = [line.strip() for line in infile if line.strip()]
    i = 0

    while i + 3 < len(lines):
        if not lines[i].isdigit():
            i += 1
            continue

        ranking = lines[i]
        name = lines[i + 1]
        team = lines[i + 2]
        stats_line = lines[i + 3]

        # Separar por tabulaciones o espacios
        stats = stats_line.replace('\t', ' ').split()
        if len(stats) != 3:
            print(f"❌ Error en estadísticas en línea {i+3}: '{stats_line}'")
            i += 1
            continue

        pm, yc, rc = stats
        writer.writerow([ranking, name, team, pm, yc, rc])
        i += 4
