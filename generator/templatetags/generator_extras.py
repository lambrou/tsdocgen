from django import template
from django.template.defaultfilters import stringfilter

register = template.Library()

typeReplacer = {
    'TSStringKeyword': 'string',
    'TSAnyKeyword': 'any',
    'TSBooleanKeyword': 'boolean',
    'TSTypeLiteral': 'user defined type',
    'TSTypeReference': 'user defined type',
    'TSObjectKeyword': 'object',
    'TSArrayType': 'array',
}


@register.filter(name="default_if_no_table")
@stringfilter
def default_if_no_table(value, default):
    if 'generator.' in value and 'None' in value:
        value = default
    return value


@register.filter(name="parse_hstore_value")
@stringfilter
def parse_hstore_value(value):
    return value.strip('{}').replace("'", '')


@register.filter(name="underscore_to_whitespace")
def underscore_to_whitespace(value):
    value = value.replace('_', ' ')
    return value.title()


@register.filter(name="widget_type")
def widget_type(value):
    return value.__class__.__name__


@register.filter(name="replace_type")
@stringfilter
def replace_type(value):
    for key, val in typeReplacer.items():
        if key in value:
            value = value.replace(key, val)

    return value
