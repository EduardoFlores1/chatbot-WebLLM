import { Component, HostListener, Inject, signal, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HTTP_WORKER_SERVICE } from './workers/web-worker.provider';
import { CommonModule, DOCUMENT } from '@angular/common';
import {} from './workers/worker.worker';
import {
  ChatCompletionMessageParam,
  ChatCompletionRequest,
  CreateWebWorkerMLCEngine,
  WebWorkerMLCEngine,
} from '@mlc-ai/web-llm';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

export interface ModelMessage {
  role: string;
  content: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FormsModule,
    CommonModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'chatbot';

  constructor(
    @Inject(HTTP_WORKER_SERVICE) private worker: Worker,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  // variables
  //readonly SELECTED_MODEL = 'Llama-3.1-8B-Instruct-q4f16_1-MLC';
  readonly SELECTED_MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k';
  engine: WebWorkerMLCEngine | undefined;

  sigIsOpen = signal<boolean>(false);
  sigInfoProgress = signal<string>('');
  sigStateButtonSend = signal<boolean>(false);
  sigMessagesList = signal<ChatCompletionMessageParam[]>([]);
  sigPopper = signal<boolean>(false);

  ngOnInit(): void {
    this.init();
  }

  async init() {
    // agregamos primer mensaje al chat
    const botMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content: '¿Qué consulta desea hacer?',
    };
    this.sigMessagesList.update((state) => [...state, botMessage]);

    if (window.Worker) {
      try {
        const worker = new Worker('./workers/worker.worker.ts');
        worker.postMessage('hello worker');
      } catch (error) {
        console.error(`Registration failed with ${error}`);
      }
    }

    this.engine = await CreateWebWorkerMLCEngine(
      this.worker,
      this.SELECTED_MODEL,
      {
        initProgressCallback: (info) => {
          // muestra la carga del modelo, es decir, que lo descargara en el ordenador del usuario
          this.sigInfoProgress.set(info.text);
          if (info.progress === 1) {
            this.sigStateButtonSend.set(true);
          }
        },
      } // engineConfig
    );
  }

  async submit(inputElement: HTMLInputElement) {
    if (this.engine) {
      const inputMessage = inputElement.value.trim();
      if (inputMessage !== '') {
        // desabilitamos el boton de enviar
        this.sigStateButtonSend.set(false);

        // reset
        inputElement.value = '';

        // mostramos lo que el usuario escribió
        const miMensaje: ChatCompletionMessageParam = {
          role: 'user',
          content: inputMessage,
        };
        this.sigMessagesList.update((state) => [...state, miMensaje]);

        // preparamos el mensaje del usuario a enviar
        const mesagges: ChatCompletionMessageParam[] = [
          {
            role: 'user',
            content:
              'response la siguiente pregunta o comentario, en un maximo de 20 palabras',
          },
          {
            role: 'user',
            content: inputMessage,
          },
        ];

        const request: ChatCompletionRequest = {
          messages: mesagges,
          stream: true,
          stream_options: { include_usage: true },
        };

        const chunks: any = await this.engine.chat.completions.create(request);

        // recibimos datos en streaming
        // agregamos la respuesta al array
        let reply = '...';
        const assisatntMessage: ChatCompletionMessageParam = {
          role: 'assistant',
          content: reply,
        };
        reply = '';
        // para mostrar el ... del bot
        this.sigMessagesList.update((state) => [...state, assisatntMessage]);

        // editamos el ultimo mensaje que es del bot
        const lastIndex = this.sigMessagesList().length - 1;
        for await (const chunk of chunks) {
          reply += chunk.choices[0]?.delta.content || '';

          // metodo poco ortodoxo
          this.sigMessagesList.update((state) => {
            state[lastIndex].content = reply;
            return [...state];
          });

          if (chunk.usage) {
            // habilitamos el boton de enviar
            this.sigStateButtonSend.set(true); // only last chunk has usage
          }
        }
      }
    }
  }

  openChat() {
    this.sigIsOpen.set(true);
  }

  closeChat() {
    this.sigIsOpen.set(false);
  }

  @HostListener('document:mouseup')
  private mousekHerramienta() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    // si solo si xd, hay texto ps sano
    if (selectedText) {
      this.sigPopper.set(true);
      const range = selection!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const popover = this._document.getElementById('popover')!;
      const popoverText = this._document.getElementById('popover__text')!;

      popoverText.textContent = selectedText;
      popover.style.left = `${rect.left + window.scrollX}px`;
      popover.style.top = `${
        rect.top + window.scrollY - popover.offsetHeight
      }px`;
    } else {
      this.sigPopper.set(false);
    }
  }

  copyText() {
    const selectedText = this._document.getElementById('popover__text')!.textContent;
    // si solo si xd, hay texto ps sano
    if (selectedText) {
      navigator.clipboard.writeText(selectedText).then(() => {
        alert('Copiado');
      });
    }
  }

  openPestania() {
    const selectedText = this._document.getElementById('popover__text')!.textContent;
    if(selectedText) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        selectedText
      )}`;
      window.open(searchUrl, '_blank');
    }
    this.sigPopper.set(false);
  }

  searchBotPopper(inputElement: HTMLInputElement) {
    inputElement.value = this._document.getElementById('popover__text')!.textContent!;
    this.openChat();
    this.sigPopper.set(false);
  }

  ngOnDestroy(): void {
    this.worker.terminate();
  }
}
