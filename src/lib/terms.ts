/**
 * Bases y condiciones de HABA (texto provisto por Amaoto Craft).
 *
 * Para modificar el texto: editar TERMS_SECTIONS, actualizar TERMS_LAST_UPDATED
 * y subir TERMS_VERSION si el cambio es sustancial (se pide una nueva aceptación
 * a todas las usuarias). Con TERMS_VERSION en null se desactivan la página
 * /terminos, los enlaces y el pedido de aceptación.
 *
 * La aceptación se guarda en user_metadata (terms_version, terms_accepted_at),
 * por lo que no requiere migraciones en la base de datos.
 */

export const TERMS_VERSION: string | null = "2026-10";

export const TERMS_LAST_UPDATED = "14 de octubre de 2026";

export type TermsBlock = string | { subtitle: string } | { list: string[] };

export interface TermsSection {
  title: string;
  blocks: TermsBlock[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    "title": "1. Identificación y aceptación",
    "blocks": [
      "Las presentes Bases y Condiciones regulan el acceso, uso y contratación de HABA, una plataforma digital destinada a ayudar a emprendedores, trabajadores independientes y pequeños negocios a calcular costos, establecer precios de venta y elaborar presupuestos.",
      "La plataforma es ofrecida por Giulianna Ornella Vanina Penna, CUIT 23-33597904-4, con domicilio en Calle 2 s/n, Manzana 9, lote 5, Barrio Nueva Esperanza (Argüello), Córdoba Capital, CP 5147, Córdoba, Argentina, en adelante, «HABA» o «la Titular».",
      "El registro, la contratación de un plan o la utilización de las funcionalidades sujetas a estas condiciones implica la aceptación de este documento, previa puesta a disposición del usuario y mediante el mecanismo de aceptación habilitado en la plataforma.",
      "La aceptación electrónica quedará registrada junto con la fecha y hora correspondientes y, cuando esté disponible, la versión de las condiciones aceptadas.",
      "Si el usuario no está de acuerdo con estas condiciones, deberá abstenerse de contratar o utilizar la plataforma."
    ]
  },
  {
    "title": "2. ¿Qué es HABA y para qué sirve?",
    "blocks": [
      "HABA es una herramienta digital de cálculo destinada a facilitar la organización de los costos de productos y servicios, la determinación de precios y la elaboración de presupuestos.",
      "Según las funcionalidades disponibles en cada momento, la plataforma puede permitir:",
      {
        "list": [
          "Registrar insumos, materiales y sus costos.",
          "Incorporar cantidades utilizadas, fracciones, superficies y rendimientos, según las opciones habilitadas.",
          "Registrar gastos del emprendimiento y asignar valor al tiempo de trabajo.",
          "Calcular costos de productos o servicios.",
          "Estimar precios de venta, márgenes y ganancias.",
          "Diferenciar precios minoristas y mayoristas, cuando corresponda.",
          "Elaborar y generar presupuestos en formato digital o PDF.",
          "Utilizar herramientas complementarias que se incorporen y comuniquen oficialmente."
        ]
      },
      "Las funcionalidades efectivamente disponibles dependerán del plan contratado y de la versión de HABA habilitada para el usuario.",
      "HABA es una herramienta de apoyo para el cálculo y la presupuestación. No constituye un sistema integral de administración empresarial, un servicio de contabilidad, asesoramiento impositivo, jurídico o financiero, ni reemplaza las obligaciones profesionales o legales de cada emprendimiento."
    ]
  },
  {
    "title": "3. Registro y creación de cuenta",
    "blocks": [
      "Para crear una cuenta, el usuario deberá proporcionar información veraz, completa y actualizada, incluyendo los datos que solicite el formulario de registro, como nombre y apellido, correo electrónico, WhatsApp y nombre del emprendimiento.",
      "El registro podrá requerir la verificación del correo electrónico mediante un enlace u otro mecanismo habilitado.",
      "Cada cuenta es personal para el titular registrado, quien será responsable de mantener la confidencialidad de sus credenciales y de las actividades realizadas desde ella.",
      "El usuario deberá notificar a HABA, a través de los canales de soporte publicados, cualquier acceso no autorizado, sospecha de uso indebido o incidente de seguridad del que tome conocimiento.",
      "HABA podrá solicitar información razonablemente necesaria para verificar la titularidad de una cuenta, resolver incidentes o prevenir usos fraudulentos.",
      "No está permitido utilizar la plataforma para actividades ilícitas, suplantar identidades, intentar acceder a cuentas ajenas, interferir en el funcionamiento del sistema o vulnerar sus medidas de seguridad."
    ]
  },
  {
    "title": "4. Prueba gratuita de 15 días",
    "blocks": [
      "HABA podrá ofrecer una prueba gratuita de quince (15) días corridos, conforme a las condiciones comunicadas al momento del registro.",
      "El período de prueba comenzará en la fecha y hora de activación informadas por la plataforma. La fecha de finalización deberá poder consultarse o comunicarse al usuario.",
      "La prueba gratuita permite utilizar las funcionalidades que HABA habilite para esa modalidad, sin que ello implique una contratación paga automática por el solo hecho de registrarse.",
      "Finalizada la prueba, si el usuario no contrata una suscripción paga, el acceso a las funcionalidades reservadas a usuarios con plan vigente podrá suspenderse.",
      "Para continuar utilizando dichas funcionalidades, el usuario deberá contratar un plan y completar el procedimiento de pago correspondiente.",
      "La prueba gratuita se ofrecerá una sola vez por persona o emprendimiento, salvo que HABA comunique expresamente una promoción diferente. HABA podrá verificar razonablemente si ya se utilizó una prueba anterior, respetando la normativa aplicable sobre datos personales.",
      "La existencia de una prueba gratuita no implica que el usuario tenga derecho a una nueva prueba al cambiar de plan, cancelar una suscripción o crear otra cuenta."
    ]
  },
  {
    "title": "5. Planes, precios y contratación",
    "blocks": [
      "HABA podrá ofrecer diferentes modalidades de suscripción, incluyendo planes mensuales, trimestrales, anuales u otras alternativas que se comuniquen oficialmente.",
      "Antes de contratar, el usuario podrá consultar el precio, la duración, las funcionalidades incluidas y las condiciones de pago del plan elegido.",
      "Los importes aplicables serán los informados al momento de la contratación, en la moneda correspondiente al país o modalidad habilitada para el usuario.",
      "Los precios deberán informarse de forma clara, incluyendo los impuestos y cargos que legalmente correspondan.",
      "La contratación de un plan supone la aceptación de su precio y periodicidad de cobro, sin perjuicio de los derechos que correspondan al usuario conforme a la legislación aplicable.",
      "Los planes trimestrales y anuales, cuando se ofrezcan, tendrán la duración y modalidad de renovación expresamente informadas antes de contratar. No se presumirá una renovación automática si esta no fue informada y aceptada de manera clara."
    ]
  },
  {
    "title": "6. Cobro proporcional inicial y fecha de facturación",
    "blocks": [
      {
        "subtitle": "6.1. Fecha de cobro habitual"
      },
      "La fecha habitual de cobro de las suscripciones mensuales de HABA será el día 8 de cada mes calendario.",
      "El pago podrá efectuarse mediante débito automático a través de Mercado Pago o mediante otro medio de pago que HABA habilite para determinados usuarios.",
      "Cuando el medio utilizado no permita un débito automático, el usuario deberá efectuar el pago por el canal y dentro del plazo que HABA le comunique.",
      {
        "subtitle": "6.2. Primer pago proporcional"
      },
      "Cuando la fecha de inicio de la suscripción paga no coincida con el día 8, el primer cobro podrá calcularse proporcionalmente por los días de servicio comprendidos entre la activación del plan pago y el próximo día 8 que corresponda.",
      "En consecuencia:",
      {
        "list": [
          "Si la suscripción paga comienza antes del día 8 del mes, el importe inicial cubrirá proporcionalmente el período hasta el día 8 de ese mismo mes.",
          "Si comienza después del día 8, el importe inicial cubrirá proporcionalmente el período hasta el día 8 del mes siguiente."
        ]
      },
      "El importe proporcional se calculará tomando como referencia el precio mensual vigente del plan, dividido por la cantidad de días calendario del mes correspondiente, multiplicado por los días de servicio incluidos en el período inicial.",
      "HABA deberá informar al usuario el importe y el período que cubre antes de realizar el cobro.",
      {
        "subtitle": "6.3. Cobros posteriores"
      },
      "Una vez finalizado el período inicial proporcional, el importe completo del plan mensual se cobrará el día 8 de cada mes, conforme al precio vigente para la suscripción contratada.",
      "El pago correspondiente al día 8 cubrirá el período mensual que se informe en la contratación y en los registros de pago.",
      "HABA deberá procurar que el cobro proporcional inicial y el cobro mensual posterior no generen superposición de períodos ya abonados.",
      {
        "subtitle": "6.4. Inicio posterior a la prueba gratuita"
      },
      "Cuando el usuario se incorpore a un plan pago luego de finalizar la prueba gratuita, la fecha de inicio de la suscripción paga será la que se le comunique al contratar.",
      "El cobro proporcional se calculará desde el inicio efectivo del servicio pago hasta el siguiente día 8 que corresponda, sin cobrar retroactivamente el período de prueba gratuita.",
      {
        "subtitle": "6.5. Medios de pago alternativos"
      },
      "Cuando el pago no se realice mediante débito automático, HABA podrá enviar un enlace de pago, solicitar una transferencia u ofrecer otro mecanismo disponible.",
      "En estos casos, el usuario deberá respetar la fecha de vencimiento informada. El hecho de utilizar un medio alternativo no modifica por sí solo la periodicidad de la suscripción ni la fecha habitual de pago.",
      {
        "subtitle": "6.6. Comprobantes"
      },
      "El usuario deberá conservar los comprobantes de pago. HABA registrará los pagos que pueda verificar y podrá solicitar el comprobante cuando sea necesario para resolver diferencias.",
      "La confirmación de una operación pendiente no equivale a la acreditación definitiva del pago."
    ]
  },
  {
    "title": "7. Renovación, pagos rechazados y falta de pago",
    "blocks": [
      "Las suscripciones con renovación automática continuarán conforme a la periodicidad informada y aceptada al contratar, hasta que sean canceladas.",
      "Los débitos podrán ser rechazados por falta de fondos, vencimiento del medio de pago, restricciones del proveedor de pagos u otras causas ajenas a HABA.",
      "Cuando se detecte un pago rechazado o pendiente, HABA podrá notificar al usuario y solicitar que regularice su situación mediante el medio disponible.",
      "Mientras el pago no se encuentre acreditado, la suscripción podrá figurar como pendiente.",
      "Si el pago continúa sin regularizarse, HABA podrá suspender el acceso a las funcionalidades pagas conforme a los plazos y avisos informados al usuario, respetando las normas aplicables.",
      "La suspensión por falta de pago no deberá confundirse con la cancelación de la suscripción: si el usuario desea evitar renovaciones futuras, deberá solicitar la baja o cancelar la renovación mediante el procedimiento habilitado.",
      "Una vez acreditado el pago, HABA restablecerá el acceso conforme al estado de la cuenta y a las posibilidades técnicas del sistema.",
      "Si se detectara un cobro duplicado, un error de facturación o un pago correctamente realizado que no se refleje en la cuenta, el usuario podrá contactar al soporte para solicitar su revisión."
    ]
  },
  {
    "title": "8. Modificaciones de precios y planes",
    "blocks": [
      "HABA podrá modificar sus precios, planes y funcionalidades para futuras contrataciones o renovaciones, informando previamente al usuario afectado con una antelación razonable y conforme a las exigencias legales aplicables.",
      "Las modificaciones de precio no deberán aplicarse retroactivamente a períodos ya abonados.",
      "Cuando una modificación requiera aceptación expresa o permita al usuario cancelar sin cargos, se respetarán los derechos correspondientes.",
      "El usuario podrá optar por cancelar su suscripción si no está de acuerdo con las nuevas condiciones, sin perjuicio de las obligaciones ya devengadas y de los derechos que la ley le reconozca."
    ]
  },
  {
    "title": "9. Cancelación de la suscripción y baja de cuenta",
    "blocks": [
      "El usuario podrá cancelar su suscripción mediante el mecanismo habilitado en HABA, a través del medio de contratación cuando corresponda o mediante el canal de soporte informado.",
      "La solicitud de baja deberá poder realizarse de forma clara y accesible, sin exigir trámites irrazonables ni requisitos adicionales que contradigan la normativa aplicable.",
      "Cuando corresponda legalmente, HABA habilitará el mecanismo digital de baja exigido para servicios contratados en línea.",
      "La cancelación de una suscripción impedirá las renovaciones futuras una vez procesada. HABA comunicará la fecha efectiva de la baja y el estado del acceso.",
      "La baja no autoriza a cobrar un preaviso, una penalidad por cancelar o períodos futuros que la legislación prohíba cobrar. Los importes ya abonados y los eventuales reintegros se resolverán conforme a la normativa aplicable, las condiciones de contratación y las circunstancias de cada caso.",
      "Si el usuario desea eliminar también su cuenta, deberá solicitar expresamente la baja de cuenta cuando ese trámite sea distinto de la cancelación de la suscripción.",
      "La eliminación de una cuenta no implica necesariamente la supresión inmediata de todos los registros que deban conservarse por obligaciones legales, contables o para atender reclamos, siempre dentro de los límites legales y durante el tiempo necesario."
    ]
  },
  {
    "title": "10. Funcionamiento de los cálculos y responsabilidad sobre los datos",
    "blocks": [
      "Los resultados de HABA dependen de la información ingresada por el usuario, de las referencias utilizadas por la herramienta y de las opciones seleccionadas para cada cálculo.",
      "El usuario es responsable de cargar datos correctos y revisar que las unidades, cantidades, precios de compra, rendimientos, tiempos de trabajo, gastos y demás parámetros reflejen razonablemente su actividad.",
      "Las referencias y estimaciones proporcionadas por HABA son herramientas orientativas. El consumo, rendimiento, costo real y resultado económico pueden variar por factores propios de cada material, producto, equipo, método de trabajo, proveedor y emprendimiento.",
      "Cuando HABA permita editar una referencia o parámetro, el usuario podrá adaptarlo a su experiencia o información específica, dentro de las opciones habilitadas.",
      "HABA no garantiza que un precio calculado asegure ventas, rentabilidad, recuperación de la inversión o un determinado nivel de ganancias.",
      "El usuario deberá evaluar los resultados antes de utilizarlos comercialmente, realizar presupuestos o asumir compromisos con sus propios clientes.",
      "HABA no será responsable por decisiones comerciales tomadas exclusivamente sobre la base de resultados que el usuario no haya revisado, datos incorrectos ingresados por este o circunstancias externas que no pueda controlar, sin perjuicio de las responsabilidades que legalmente correspondan a HABA por sus propios incumplimientos."
    ]
  },
  {
    "title": "11. Actualización de costos y modificación de productos",
    "blocks": [
      "Cuando cambie el precio de un insumo registrado, HABA podrá advertir al usuario que existen productos cuyos costos pueden verse afectados.",
      "Si la plataforma ofrece una opción para recalcular o actualizar esos productos, el usuario deberá revisar los cambios propuestos y confirmar la operación cuando así lo requiera el sistema.",
      "Una modificación en el costo de un insumo no deberá interpretarse, por sí sola, como autorización para modificar automáticamente los precios de venta definidos por el usuario cuando la funcionalidad requiera su confirmación.",
      "El usuario es responsable de revisar los costos y precios finales antes de utilizarlos en ventas o presupuestos."
    ]
  },
  {
    "title": "12. Presupuestos y documentos generados",
    "blocks": [
      "Los presupuestos generados por HABA se confeccionan a partir de los datos y parámetros ingresados por el usuario.",
      "El usuario deberá verificar la descripción del producto o servicio, cantidades, precios, moneda, condiciones comerciales, vigencia, datos del cliente y demás información antes de enviar o aceptar un presupuesto.",
      "La generación de un presupuesto no implica que HABA intervenga en la negociación entre el usuario y su cliente ni que garantice la aceptación, pago o cumplimiento de ese presupuesto.",
      "El usuario es responsable de las condiciones que ofrezca a sus propios clientes y de cumplir con las obligaciones legales, fiscales y comerciales aplicables a su actividad."
    ]
  },
  {
    "title": "13. Disponibilidad, mantenimiento y modificaciones técnicas",
    "blocks": [
      "HABA procurará mantener la plataforma operativa y accesible, pero no garantiza disponibilidad ininterrumpida ni ausencia absoluta de errores.",
      "Podrán producirse interrupciones por mantenimiento, actualizaciones, fallas de infraestructura, problemas de conectividad, incidentes de seguridad, servicios de terceros o circunstancias de fuerza mayor.",
      "Cuando sea posible, HABA procurará informar previamente las interrupciones programadas que puedan afectar de manera significativa el servicio.",
      "HABA podrá corregir errores, actualizar componentes y modificar la presentación o el funcionamiento de las herramientas, procurando no afectar injustificadamente las funcionalidades contratadas.",
      "Las modificaciones que impliquen una reducción sustancial del servicio contratado deberán tratarse conforme a las condiciones ofrecidas y a los derechos legales del usuario."
    ]
  },
  {
    "title": "14. Soporte y comunicación",
    "blocks": [
      "HABA brindará soporte a través de los canales que se encuentren informados en la plataforma, incluyendo el contacto de WhatsApp cuando esté habilitado.",
      "El soporte estará destinado a consultas sobre acceso, funcionamiento, pagos, suscripciones y uso de las herramientas.",
      "Los tiempos de respuesta podrán variar según la naturaleza y complejidad de la consulta. Salvo que se comunique expresamente un plazo de atención, el canal de soporte no supone disponibilidad inmediata ni atención permanente.",
      "Las mejoras, desarrollos particulares, integraciones con servicios externos, migraciones de datos o funcionalidades no incluidas en el plan podrán requerir una cotización adicional."
    ]
  },
  {
    "title": "15. Datos personales y privacidad",
    "blocks": [
      "HABA tratará los datos personales proporcionados durante el registro y el uso de la plataforma con las finalidades de crear y administrar cuentas, verificar identidades y correos electrónicos, gestionar suscripciones y pagos, brindar soporte, mantener la seguridad del sistema y cumplir obligaciones legales.",
      "Los datos podrán ser tratados por proveedores tecnológicos y de pago que intervengan en el funcionamiento de HABA, únicamente en la medida necesaria para prestar sus servicios y conforme a las obligaciones aplicables.",
      "HABA no deberá utilizar los datos personales para finalidades incompatibles con aquellas informadas al usuario.",
      "El usuario podrá ejercer los derechos de acceso, rectificación y supresión de sus datos personales mediante el canal que HABA informe para esos fines, de acuerdo con la legislación aplicable.",
      "HABA adoptará medidas de seguridad razonables para proteger la información, sin que ello implique garantizar la inexistencia absoluta de incidentes.",
      "La información específica sobre el responsable del tratamiento, los destinatarios, los plazos de conservación, las transferencias internacionales y los mecanismos para ejercer derechos deberá desarrollarse en la Política de Privacidad de HABA, que estará disponible antes o al momento de la recopilación de datos.",
      "La aceptación de estas Bases y Condiciones no sustituye los consentimientos adicionales que legalmente deban solicitarse para otras finalidades, cuando correspondan."
    ]
  },
  {
    "title": "16. Información del emprendimiento y confidencialidad",
    "blocks": [
      "El usuario conserva la responsabilidad sobre la información comercial que carga en HABA, incluyendo costos, listas de precios, productos, clientes y presupuestos.",
      "HABA utilizará esa información para prestar y mantener las funcionalidades de la plataforma y no deberá divulgarla a terceros para finalidades ajenas al servicio, salvo autorización, obligación legal o los supuestos legítimos informados en la Política de Privacidad.",
      "El usuario deberá evitar cargar información personal o confidencial de terceros que no resulte necesaria para utilizar las herramientas.",
      "El usuario también es responsable de mantener sus propios registros y comprobantes cuando necesite conservarlos para sus obligaciones comerciales, fiscales o contables."
    ]
  },
  {
    "title": "17. Propiedad intelectual y uso permitido",
    "blocks": [
      "La plataforma HABA, su diseño, marca, textos, estructura, componentes, código y demás elementos protegidos pertenecen a sus respectivos titulares o se utilizan con autorización.",
      "El acceso a HABA concede al usuario un derecho limitado, personal, no exclusivo e intransferible de uso durante la vigencia de su acceso, conforme al plan contratado.",
      "No está permitido copiar, revender, distribuir, descompilar, alterar o explotar comercialmente la plataforma o sus componentes fuera de los usos autorizados por la ley o por una autorización expresa.",
      "Los datos comerciales y contenidos propios ingresados por el usuario no pasan a ser propiedad de HABA por el mero hecho de cargarlos en la plataforma."
    ]
  },
  {
    "title": "18. Suspensión por uso indebido",
    "blocks": [
      "HABA podrá adoptar medidas proporcionadas ante indicios razonables de fraude, acceso no autorizado, utilización ilícita, ataques al sistema, suplantación de identidad o incumplimientos graves de estas condiciones.",
      "Según la situación, las medidas podrán incluir una solicitud de aclaración, restricción temporal, suspensión o cancelación del acceso.",
      "Cuando sea razonablemente posible, HABA informará al usuario el motivo de la medida y el procedimiento para solicitar una revisión.",
      "Las medidas deberán ser proporcionales a la situación y no podrán utilizarse para desconocer derechos legales del usuario ni para evitar el cumplimiento de obligaciones contractuales de HABA."
    ]
  },
  {
    "title": "19. Servicios de terceros",
    "blocks": [
      "HABA podrá utilizar servicios externos para procesar pagos, enviar correos electrónicos, alojar información, verificar cuentas o brindar otras funcionalidades.",
      "El funcionamiento de estos servicios puede depender de sus propios proveedores y condiciones.",
      "HABA no controla todas las decisiones ni interrupciones de dichos terceros, pero continuará siendo responsable por las obligaciones que legalmente le correspondan en relación con el servicio que ofrece.",
      "Los pagos realizados a través de Mercado Pago estarán sujetos también a las condiciones y procedimientos aplicables de dicho proveedor, sin que ello sustituya los derechos del usuario frente a HABA."
    ]
  },
  {
    "title": "20. Modificaciones de estas Bases y Condiciones",
    "blocks": [
      "HABA podrá actualizar estas Bases y Condiciones para reflejar cambios legales, técnicos, comerciales o funcionales.",
      "La versión vigente estará disponible en la plataforma, con su fecha de actualización.",
      "Cuando los cambios sean sustanciales, afecten derechos u obligaciones relevantes o requieran aceptación expresa, HABA deberá comunicarlos de manera adecuada y solicitar una nueva aceptación cuando corresponda.",
      "Las modificaciones no se aplicarán retroactivamente en perjuicio de derechos adquiridos ni podrán excluir obligaciones legales vigentes."
    ]
  },
  {
    "title": "21. Atención de reclamos",
    "blocks": [
      "El usuario podrá realizar consultas, informar errores o presentar reclamos mediante el canal de soporte publicado en HABA.",
      "Para facilitar la revisión, podrá solicitarse la identificación de la cuenta, la descripción del inconveniente y, cuando corresponda, comprobantes o capturas relacionadas con el reclamo.",
      "HABA procurará analizar las solicitudes y comunicar una respuesta razonable según la naturaleza del caso.",
      "El procedimiento interno de soporte no limita el derecho del usuario a acudir a los organismos administrativos o judiciales competentes."
    ]
  },
  {
    "title": "22. Legislación aplicable y resolución de controversias",
    "blocks": [
      "Estas Bases y Condiciones se interpretarán conforme a la legislación aplicable en cada caso.",
      "Cuando corresponda aplicar las normas argentinas, se respetarán, entre otras, las disposiciones pertinentes del Código Civil y Comercial de la Nación, la Ley de Defensa del Consumidor N.º 24.240 y la Ley de Protección de Datos Personales N.º 25.326, junto con sus normas complementarias y modificatorias.",
      "Las controversias se someterán a las autoridades administrativas o judiciales competentes según la legislación aplicable, sin imponer renuncias anticipadas a derechos ni limitar las competencias que legalmente correspondan."
    ]
  },
  {
    "title": "23. Contacto",
    "blocks": [
      "Para consultas relacionadas con el funcionamiento de HABA, pagos, suscripciones, cancelaciones o ejercicio de derechos, el usuario podrá comunicarse a través de:",
      {
        "list": [
          "Soporte HABA: +54 9 351 312-2522.",
          "Correo electrónico: haba.com.ar@gmail.com.",
          "Titular responsable: Giulianna Ornella Vanina Penna.",
          "CUIT: 23-33597904-4.",
          "Domicilio legal: Calle 2 s/n, Manzana 9, lote 5, Barrio Nueva Esperanza (Argüello), Córdoba Capital, CP 5147, Córdoba, Argentina."
        ]
      },
      "La versión vigente de estas Bases y Condiciones estará disponible desde el sitio web y el perfil de usuario de HABA.",
      "Al registrarse o contratar una suscripción, el usuario declara haber tenido acceso a estas Bases y Condiciones, haber podido leerlas y aceptarlas expresamente."
    ]
  }
];

export function isTermsEnabled(): boolean {
  return Boolean(TERMS_VERSION) && TERMS_SECTIONS.length > 0;
}

export function needsTermsAcceptance(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!isTermsEnabled()) return false;
  return metadata?.terms_version !== TERMS_VERSION;
}
