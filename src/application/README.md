# Aplicação — contrato de áudio

`audioPort.ts` define o contrato de reprodução, handles, resultados e interrupções implementado pela engine da Fase 3. Não depende de React, DOM ou regras do jogo.

O controlador que coordenará domínio e áudio será implementado na Fase 4. Ele deverá capturar o contexto da execução antes de operações assíncronas, distinguir resultados cancelados de referências concluídas e aplicar a política de visibilidade por estado. React pode existir no adaptador de integração; as regras permanecem no domínio.
