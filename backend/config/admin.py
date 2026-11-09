from django.contrib import admin
from django.contrib.admin.views.main import ChangeList


class NumberedChangeList(ChangeList):
    def get_results(self, request):
        super().get_results(request)
        first_number = (
            1
            if self.show_all and self.can_show_all
            else (self.page_num - 1) * self.list_per_page + 1
        )
        for number, item in enumerate(self.result_list, start=first_number):
            item.admin_row_number = number


class NumberedAdminMixin:
    def get_changelist(self, request, **kwargs):
        return NumberedChangeList

    @admin.display(description="No.")
    def row_number(self, obj):
        return obj.admin_row_number
