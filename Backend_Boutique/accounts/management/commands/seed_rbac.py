from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

from accounts.models import AppPermission, Role


DEFAULT_PERMISSIONS = [
    # Users & RBAC
    {"code": "users.view", "name": "Ver usuarios", "description": "Puede ver la lista y detalle de usuarios.", "actions": ["view"]},
    {"code": "users.manage", "name": "Gestionar usuarios", "description": "Crear, editar y desactivar usuarios.", "actions": ["create", "update", "deactivate"]},
    {"code": "roles.view", "name": "Ver roles", "description": "Puede ver los roles disponibles.", "actions": ["view"]},
    {"code": "roles.manage", "name": "Gestionar roles", "description": "Crear, editar, asignar y eliminar roles.", "actions": ["create", "update", "assign", "delete"]},
    {"code": "permissions.view", "name": "Ver permisos", "description": "Puede ver permisos de la aplicación.", "actions": ["view"]},
    {"code": "permissions.manage", "name": "Gestionar permisos", "description": "Crear, editar y asignar permisos.", "actions": ["create", "update", "assign", "delete"]},

    # Inventory
    {"code": "inventory.view", "name": "Ver inventario", "description": "Acceso a ver productos e inventario.", "actions": ["view"]},
    {"code": "inventory.manage", "name": "Gestionar inventario", "description": "Crear/editar productos, ajustar stock.", "actions": ["create", "update", "adjust", "delete"]},

    # Sales
    {"code": "sales.view", "name": "Ver ventas", "description": "Puede ver las ventas y comprobantes.", "actions": ["view"]},
    {"code": "sales.create", "name": "Crear ventas", "description": "Puede crear ventas y emitir comprobantes.", "actions": ["create"]},
    {"code": "sales.refund", "name": "Devolver ventas", "description": "Puede realizar devoluciones o notas de crédito.", "actions": ["refund"]},

    # Reports
    {"code": "reports.view", "name": "Ver reportes", "description": "Acceso a reportes y estadísticas.", "actions": ["view", "export"]},

    # Settings
    {"code": "settings.manage", "name": "Configurar sistema", "description": "Acceso a configuración general de la boutique.", "actions": ["update"]},
]


DEFAULT_ROLES = [
    {
        "name": "Owner",
        "description": "Dueño de la boutique con control total del panel (excepto panel admin de Django)",
        "permissions": [
            "users.view", "users.manage",
            "roles.view", "roles.manage",
            "permissions.view", "permissions.manage",
            "inventory.view", "inventory.manage",
            "sales.view", "sales.create", "sales.refund",
            "reports.view", "settings.manage",
        ],
    },
    {
        "name": "Seller",
        "description": "Vendedor con permisos para registrar ventas y ver inventario",
        "permissions": [
            "inventory.view",
            "sales.view", "sales.create",
            "reports.view",
        ],
    },
    {
        "name": "Inventory Manager",
        "description": "Gestor de inventario (ABM de productos y stock)",
        "permissions": [
            "inventory.view", "inventory.manage",
            "reports.view",
        ],
    },
    {
        "name": "Viewer",
        "description": "Solo lectura de catálogos y reportes",
        "permissions": [
            "inventory.view", "sales.view", "reports.view",
        ],
    },
]


class Command(BaseCommand):
    help = "Crea permisos y roles predeterminados para el sistema RBAC. Idempotente."

    def add_arguments(self, parser):
        parser.add_argument(
            "--assign-owners",
            action="store_true",
            help="Asigna el rol 'Owner' a usuarios con user_type='admin'",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Seeding RBAC (permisos y roles)..."))

        # Crear/actualizar permisos
        code_to_perm = {}
        created_count = 0
        updated_count = 0
        for p in DEFAULT_PERMISSIONS:
            perm, created = AppPermission.objects.get_or_create(code=p["code"], defaults={
                "name": p["name"],
                "description": p.get("description", ""),
                "actions": p.get("actions", []),
                "is_active": True,
            })
            if not created:
                # Update fields if changed
                changed = False
                if perm.name != p["name"]:
                    perm.name = p["name"]; changed = True
                if perm.description != p.get("description", ""):
                    perm.description = p.get("description", ""); changed = True
                if perm.actions != p.get("actions", []):
                    perm.actions = p.get("actions", []); changed = True
                if not perm.is_active:
                    perm.is_active = True; changed = True
                if changed:
                    perm.save(); updated_count += 1
            else:
                created_count += 1
            code_to_perm[p["code"]] = perm

        self.stdout.write(self.style.SUCCESS(f"Permisos - creados: {created_count}, actualizados: {updated_count}"))

        # Crear/actualizar roles y asignar permisos
        roles_created = 0
        roles_updated = 0
        for r in DEFAULT_ROLES:
            role, created = Role.objects.get_or_create(name=r["name"], defaults={
                "description": r.get("description", ""),
                "is_active": True,
            })
            desired_perms = [code_to_perm[c] for c in r["permissions"] if c in code_to_perm]
            if created:
                role.permissions.set(desired_perms)
                roles_created += 1
            else:
                changed = False
                # Update description/is_active if needed
                if role.description != r.get("description", ""):
                    role.description = r.get("description", ""); changed = True
                if not role.is_active:
                    role.is_active = True; changed = True
                # Sync permissions set
                current_ids = set(role.permissions.values_list("id", flat=True))
                desired_ids = set(p.id for p in desired_perms)
                if current_ids != desired_ids:
                    role.permissions.set(desired_perms)
                    changed = True
                if changed:
                    role.save()
                    roles_updated += 1

        self.stdout.write(self.style.SUCCESS(f"Roles - creados: {roles_created}, actualizados: {roles_updated}"))

        # Asignar Owner a dueños si se solicita
        if options.get("assign_owners"):
            User = get_user_model()
            owners = User.objects.filter(user_type='admin', is_active=True)
            try:
                owner_role = Role.objects.get(name="Owner")
            except Role.DoesNotExist:
                self.stdout.write(self.style.WARNING("Rol 'Owner' no encontrado; no se puede asignar."))
            else:
                count = 0
                for u in owners:
                    if not u.roles.filter(id=owner_role.id).exists():
                        u.roles.add(owner_role)
                        count += 1
                self.stdout.write(self.style.SUCCESS(f"Rol 'Owner' asignado a {count} usuario(s) con user_type='admin'."))

        self.stdout.write(self.style.HTTP_INFO("RBAC seeding completado."))
