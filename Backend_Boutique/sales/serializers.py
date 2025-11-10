from rest_framework import serializers
from orders.serializers import OrderSerializer
from rest_framework import serializers


class SalesOrderSerializer(OrderSerializer):
    # Inherit existing fields; could extend with more admin-only info later
    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['user_id','user_email','user_username','user_first_name','user_last_name']

    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_email = serializers.SerializerMethodField(read_only=True)
    user_username = serializers.SerializerMethodField(read_only=True)
    user_first_name = serializers.SerializerMethodField(read_only=True)
    user_last_name = serializers.SerializerMethodField(read_only=True)

    def get_user_email(self, obj):
        try:
            return obj.user.email
        except Exception:
            return None

    def get_user_username(self, obj):
        try:
            return obj.user.username
        except Exception:
            return None

    def get_user_first_name(self, obj):
        try:
            return obj.user.first_name
        except Exception:
            return None

    def get_user_last_name(self, obj):
        try:
            return obj.user.last_name
        except Exception:
            return None
