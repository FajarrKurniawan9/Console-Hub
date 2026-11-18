<?php

use App\Services\Exceptions\TemplateException;
use App\Services\TemplateRenderer;

$context = [
    'input' => ['customer' => 'PT Maju', 'qty' => 5, 'sku' => 'BJ 01/A'],
    'steps' => ['1' => ['response' => ['status' => 201, 'body' => ['order_no' => 'PO-9', 'meta' => ['id' => 42]]]]],
];

it('keeps the original type for a whole-value placeholder', function () use ($context) {
    $body = ['qty' => '{{input.qty}}', 'lines' => [['qty' => '{{ input.qty }}']], 'status' => '{{steps.1.response.status}}'];

    expect(app(TemplateRenderer::class)->render($body, $context))
        ->toBe(['qty' => 5, 'lines' => [['qty' => 5]], 'status' => 201]);
});

it('interpolates placeholders inside strings', function () use ($context) {
    expect(app(TemplateRenderer::class)->render('Pesanan {{input.customer}} #{{steps.1.response.body.meta.id}}', $context))
        ->toBe('Pesanan PT Maju #42');
});

it('url-encodes values in paths', function () use ($context) {
    expect(app(TemplateRenderer::class)->renderPath('/items/{{input.sku}}/orders/{{steps.1.response.body.order_no}}', $context))
        ->toBe('/items/BJ%2001%2FA/orders/PO-9');
});

it('fails on missing variables', function () use ($context) {
    app(TemplateRenderer::class)->render(['x' => '{{steps.2.response.body.id}}'], $context);
})->throws(TemplateException::class, 'tidak tersedia');

it('refuses secret placeholders', function () use ($context) {
    app(TemplateRenderer::class)->render('{{secret.password}}', $context);
})->throws(TemplateException::class, 'tidak diizinkan');

it('refuses a path that renders to an absolute url', function () {
    app(TemplateRenderer::class)->renderPath('{{input.url}}', ['input' => ['url' => 'http://evil.test']]);
})->throws(TemplateException::class);
