import type { TypeCategory } from '../src/generated/prisma/enums.ts';

type SeedProducts = {
    nombre: string;
    codigo_sku: string;
    categoria: TypeCategory;
    precio: number;
    stock_actual: number;
    stock_minimo: number;
    proveedor: string;
}

export const seedProductsData: SeedProducts[] = [
    {
        "nombre": "Agua Mineral 500ml",
        "codigo_sku": "BEB-001",
        "categoria": "Bebidas",
        "precio": 1500,
        "stock_actual": 150,
        "stock_minimo": 50,
        "proveedor": "Distribuidora Andina"
    },
    {
        "nombre": "Jugo de Naranja 1L",
        "codigo_sku": "BEB-002",
        "categoria": "Bebidas",
        "precio": 3200,
        "stock_actual": 30,
        "stock_minimo": 40,
        "proveedor": "Lácteos del Valle"
    },
    {
        "nombre": "Leche Entera 1L",
        "codigo_sku": "LAC-001",
        "categoria": "Lacteos",
        "precio": 2100,
        "stock_actual": 200,
        "stock_minimo": 60,
        "proveedor": "Lácteos del Valle"
    },
    {
        "nombre": "Yogur Natural 500g",
        "codigo_sku": "LAC-002",
        "categoria": "Lacteos",
        "precio": 2800,
        "stock_actual": 15,
        "stock_minimo": 25,
        "proveedor": "Lácteos del Valle"
    },
    {
        "nombre": "Papas Fritas 200g",
        "codigo_sku": "SNA-001",
        "categoria": "Snacks",
        "precio": 2500,
        "stock_actual": 80,
        "stock_minimo": 30,
        "proveedor": "SnacksCorp"
    },
    {
        "nombre": "Detergente 1L",
        "codigo_sku": "LIM-001",
        "categoria": "Limpieza",
        "precio": 4500,
        "stock_actual": 45,
        "stock_minimo": 20,
        "proveedor": "Químicos del Sur"
    }
]
